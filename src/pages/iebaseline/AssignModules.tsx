import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CheckSquare, Loader2, Search, UserCheck, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  ieBaselineApi,
  type IEBaselineBulkAddUserModulesResponse,
  type IEBaselineModule,
  type IEBaselineUser,
} from './api';
import { useIEBaselineCurrentUser } from './useIEBaselineCurrentUser';

export const USER_PAGE_SIZE = 15;
export const MODULE_TYPE_ALL = 'all';
export const MODULE_TYPE_UNSPECIFIED = 'Unspecified';

export function filterAssignableUsers(users: IEBaselineUser[], search: string) {
  const query = normalizeSearch(search);
  if (!query) return users;

  return users.filter((user) => {
    return [
      user.name,
      user.position,
      user.wd_id === null || user.wd_id === undefined ? null : String(user.wd_id),
    ].some((value) => normalizeSearch(value).includes(query));
  });
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function getCurrentPageIds<T>(items: T[], getId: (item: T) => number) {
  return items.map(getId);
}

export function toggleCurrentPageSelection(selectedIds: Set<number>, currentPageIds: number[]) {
  const next = new Set(selectedIds);
  const allSelected = currentPageIds.length > 0 && currentPageIds.every((id) => next.has(id));

  currentPageIds.forEach((id) => {
    if (allSelected) {
      next.delete(id);
    } else {
      next.add(id);
    }
  });

  return next;
}

export function getModuleTypeLabel(module: Pick<IEBaselineModule, 'module_type'>) {
  return module.module_type?.trim() || MODULE_TYPE_UNSPECIFIED;
}

export function getUniqueModuleTypes(modules: IEBaselineModule[]) {
  return Array.from(new Set(modules.map(getModuleTypeLabel))).sort((a, b) => a.localeCompare(b));
}

export function filterAssignableModules(modules: IEBaselineModule[], search: string, moduleType: string) {
  const query = normalizeSearch(search);

  return modules.filter((module) => {
    const matchesSearch = !query || normalizeSearch(module.module_name).includes(query);
    const matchesType = moduleType === MODULE_TYPE_ALL || getModuleTypeLabel(module) === moduleType;
    return matchesSearch && matchesType;
  });
}

function normalizeSearch(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export default function AssignModules() {
  const queryClient = useQueryClient();
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<number>>(new Set());
  const [userSearch, setUserSearch] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');
  const [moduleType, setModuleType] = useState(MODULE_TYPE_ALL);
  const [userPage, setUserPage] = useState(1);
  const {
    ieBaselineUserId,
    isLoading: isResolvingCurrentUser,
    error: currentUserResolveError,
  } = useIEBaselineCurrentUser();

  const usersQuery = useQuery({
    queryKey: ['iebaseline', 'users', ieBaselineUserId],
    queryFn: () => ieBaselineApi.users.list(ieBaselineUserId!),
    enabled: Boolean(ieBaselineUserId),
  });

  const modulesQuery = useQuery({
    queryKey: ['iebaseline', 'modules', ieBaselineUserId],
    queryFn: () => ieBaselineApi.modules.list(ieBaselineUserId!),
    enabled: Boolean(ieBaselineUserId),
  });

  const users = usersQuery.data ?? [];
  const modules = modulesQuery.data ?? [];
  const filteredUsers = useMemo(() => filterAssignableUsers(users, userSearch), [users, userSearch]);
  const pagedUsers = useMemo(() => paginateItems(filteredUsers, userPage, USER_PAGE_SIZE), [filteredUsers, userPage]);
  const userPageCount = Math.max(1, Math.ceil(filteredUsers.length / USER_PAGE_SIZE));
  const currentPageUserIds = useMemo(() => getCurrentPageIds(pagedUsers, (user) => user.user_id), [pagedUsers]);
  const filteredModules = useMemo(
    () => filterAssignableModules(modules, moduleSearch, moduleType),
    [modules, moduleSearch, moduleType],
  );
  const moduleTypeOptions = useMemo(() => getUniqueModuleTypes(modules), [modules]);
  const filteredModuleIds = useMemo(() => getCurrentPageIds(filteredModules, (module) => module.module_id), [filteredModules]);
  const assignmentPairCount = selectedUserIds.size * selectedModuleIds.size;
  const canApply = Boolean(ieBaselineUserId && selectedUserIds.size > 0 && selectedModuleIds.size > 0);

  useEffect(() => {
    setUserPage(1);
  }, [userSearch]);

  useEffect(() => {
    setUserPage((current) => Math.min(current, userPageCount));
  }, [userPageCount]);

  const bulkAddMutation = useMutation({
    mutationFn: () => {
      if (!ieBaselineUserId) throw new Error('Current IE Baseline user is not resolved yet.');
      return ieBaselineApi.users.modules.bulkAdd({
        user_ids: Array.from(selectedUserIds).sort((a, b) => a - b),
        module_ids: Array.from(selectedModuleIds).sort((a, b) => a - b),
        assignee_id: ieBaselineUserId,
      }, ieBaselineUserId);
    },
    onSuccess: async (data: IEBaselineBulkAddUserModulesResponse) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'modules'] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'home'] }),
      ]);

      toast({
        title: 'Modules assigned',
        description: `Added ${data.inserted_count}, skipped ${data.unchanged_count} existing assignments.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Unable to assign modules',
        description: error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.',
        variant: 'destructive',
      });
    },
  });

  const toggleUser = (userId: number) => {
    setSelectedUserIds((current) => toggleSingleSelection(current, userId));
  };

  const toggleModule = (moduleId: number) => {
    setSelectedModuleIds((current) => toggleSingleSelection(current, moduleId));
  };

  const toggleUsersOnPage = () => {
    setSelectedUserIds((current) => toggleCurrentPageSelection(current, currentPageUserIds));
  };

  const toggleFilteredModules = () => {
    setSelectedModuleIds((current) => toggleCurrentPageSelection(current, filteredModuleIds));
  };

  return (
    <div className="space-y-6 px-6 pb-6 pt-32 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 px-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 text-foreground">
            <UserCheck className="w-5 h-5 text-primary" />
            Modules Assignment
          </h1>
          <p className="text-sm text-muted-foreground">
            Select users, choose modules, then bulk add module assignments.
          </p>
        </div>

        {selectedUserIds.size > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="w-full gap-2 sm:w-auto"
                disabled={!canApply || bulkAddMutation.isPending || usersQuery.isError || modulesQuery.isError}
              >
                {bulkAddMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
                Assign Modules
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apply module assignments?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will add {selectedModuleIds.size} module{selectedModuleIds.size === 1 ? '' : 's'} to {selectedUserIds.size} user{selectedUserIds.size === 1 ? '' : 's'}.
                  Existing assignments and progress will be preserved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid grid-cols-3 gap-3 text-center">
                <SummaryTile label="Users" value={selectedUserIds.size} />
                <SummaryTile label="Modules" value={selectedModuleIds.size} />
                <SummaryTile label="Pairs" value={assignmentPairCount} />
              </div>
              {selectedModuleIds.size === 0 && (
                <p className="text-sm text-destructive">Select at least one module before applying.</p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={bulkAddMutation.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => bulkAddMutation.mutate()} disabled={!canApply || bulkAddMutation.isPending}>
                  {bulkAddMutation.isPending ? 'Applying...' : 'Confirm apply'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <UserSelectionTable
          users={pagedUsers}
          totalUsers={users.length}
          filteredCount={filteredUsers.length}
          currentPageIds={currentPageUserIds}
          isLoading={usersQuery.isLoading || isResolvingCurrentUser}
          isError={usersQuery.isError || Boolean(currentUserResolveError)}
          error={currentUserResolveError ?? usersQuery.error}
          page={userPage}
          pageCount={userPageCount}
          search={userSearch}
          selectedUserIds={selectedUserIds}
          onPageChange={setUserPage}
          onSearchChange={setUserSearch}
          onTogglePage={toggleUsersOnPage}
          onToggleUser={toggleUser}
        />

        <ModuleSelectionTable
          modules={filteredModules}
          totalModules={modules.length}
          moduleType={moduleType}
          moduleTypeOptions={moduleTypeOptions}
          currentModuleIds={filteredModuleIds}
          isLoading={modulesQuery.isLoading || isResolvingCurrentUser}
          isError={modulesQuery.isError || Boolean(currentUserResolveError)}
          error={currentUserResolveError ?? modulesQuery.error}
          search={moduleSearch}
          selectedModuleIds={selectedModuleIds}
          onModuleTypeChange={setModuleType}
          onSearchChange={setModuleSearch}
          onToggleModule={toggleModule}
          onToggleModules={toggleFilteredModules}
        />
      </div>
    </div>
  );
}

function toggleSingleSelection(selectedIds: Set<number>, id: number) {
  const next = new Set(selectedIds);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

interface UserSelectionTableProps {
  users: IEBaselineUser[];
  totalUsers: number;
  filteredCount: number;
  currentPageIds: number[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  page: number;
  pageCount: number;
  search: string;
  selectedUserIds: Set<number>;
  onPageChange: (page: number) => void;
  onSearchChange: (search: string) => void;
  onTogglePage: () => void;
  onToggleUser: (userId: number) => void;
}

function UserSelectionTable({
  users,
  totalUsers,
  filteredCount,
  currentPageIds,
  isLoading,
  isError,
  error,
  page,
  pageCount,
  search,
  selectedUserIds,
  onPageChange,
  onSearchChange,
  onTogglePage,
  onToggleUser,
}: UserSelectionTableProps) {
  const pageAllSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedUserIds.has(id));
  const pageSomeSelected = currentPageIds.some((id) => selectedUserIds.has(id));

  return (
    <Card className="border-border/50 bg-background/40 backdrop-blur-sm overflow-hidden">
      <div className="space-y-4 border-b border-border/50 bg-muted/30 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2 text-foreground">
            <Users className="w-4 h-4 text-primary" />
            Users
          </h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{selectedUserIds.size} selected</Badge>
            <Badge variant="outline">{filteredCount} of {totalUsers}</Badge>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search name, position, or WD ID"
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 p-4 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div className="col-span-1">
          <Checkbox
            aria-label="Select users on this page"
            checked={pageAllSelected || (pageSomeSelected ? 'indeterminate' : false)}
            onCheckedChange={onTogglePage}
          />
        </div>
        <div className="col-span-4">Name</div>
        <div className="col-span-3">Position</div>
        <div className="col-span-2">WD ID</div>
        <div className="col-span-2 text-right">Assigned</div>
      </div>

      {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading users...</div>}
      {isError && <ErrorState title="Unable to load users." error={error} />}
      {!isLoading && !isError && filteredCount === 0 && (
        <div className="p-6 text-sm text-muted-foreground">No users match the current search.</div>
      )}
      {!isLoading && !isError && users.length > 0 && (
        <div className="flex flex-col">
          {users.map((user) => {
            const checked = selectedUserIds.has(user.user_id);
            return (
              <label
                key={user.user_id}
                className="grid grid-cols-12 gap-4 p-4 items-center border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors text-sm cursor-pointer"
              >
                <div className="col-span-1">
                  <Checkbox checked={checked} onCheckedChange={() => onToggleUser(user.user_id)} />
                </div>
                <div className="col-span-4 min-w-0">
                  <div className="font-medium text-foreground truncate">{user.name}</div>
                  <div className="text-xs text-muted-foreground">User ID: {user.user_id}</div>
                </div>
                <div className="col-span-3 text-muted-foreground truncate">{user.position ?? 'N/A'}</div>
                <div className="col-span-2 text-muted-foreground">{user.wd_id ?? 'N/A'}</div>
                <div className="col-span-2 text-right">
                  <Badge variant="outline">{user.assigned_module_count ?? 0}</Badge>
                </div>
              </label>
            );
          })}
        </div>
      )}

      <TablePagination page={page} pageCount={pageCount} total={filteredCount} pageSize={USER_PAGE_SIZE} onPageChange={onPageChange} />
    </Card>
  );
}

interface ModuleSelectionTableProps {
  modules: IEBaselineModule[];
  totalModules: number;
  moduleType: string;
  moduleTypeOptions: string[];
  currentModuleIds: number[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  search: string;
  selectedModuleIds: Set<number>;
  onModuleTypeChange: (moduleType: string) => void;
  onSearchChange: (search: string) => void;
  onToggleModule: (moduleId: number) => void;
  onToggleModules: () => void;
}

function ModuleSelectionTable({
  modules,
  totalModules,
  moduleType,
  moduleTypeOptions,
  currentModuleIds,
  isLoading,
  isError,
  error,
  search,
  selectedModuleIds,
  onModuleTypeChange,
  onSearchChange,
  onToggleModule,
  onToggleModules,
}: ModuleSelectionTableProps) {
  const allSelected = currentModuleIds.length > 0 && currentModuleIds.every((id) => selectedModuleIds.has(id));
  const someSelected = currentModuleIds.some((id) => selectedModuleIds.has(id));

  return (
    <Card className="border-border/50 bg-background/40 backdrop-blur-sm overflow-hidden">
      <div className="space-y-4 border-b border-border/50 bg-muted/30 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2 text-foreground">
            <BookOpen className="w-4 h-4 text-primary" />
            Modules
          </h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{selectedModuleIds.size} selected</Badge>
            <Badge variant="outline">{modules.length} of {totalModules}</Badge>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search module name"
              className="pl-9"
            />
          </div>
          <Select value={moduleType} onValueChange={onModuleTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Module type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MODULE_TYPE_ALL}>All types</SelectItem>
              {moduleTypeOptions.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 p-4 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div className="col-span-1">
          <Checkbox
            aria-label="Select visible modules"
            checked={allSelected || (someSelected ? 'indeterminate' : false)}
            onCheckedChange={onToggleModules}
          />
        </div>
        <div className="col-span-4">Module</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-3">Owner</div>
        <div className="col-span-2 text-right">Questions</div>
      </div>

      {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading modules...</div>}
      {isError && <ErrorState title="Unable to load modules." error={error} />}
      {!isLoading && !isError && modules.length === 0 && (
        <div className="p-6 text-sm text-muted-foreground">No modules match the current filters.</div>
      )}
      {!isLoading && !isError && modules.length > 0 && (
        <div className="flex flex-col">
          {modules.map((module) => {
            const checked = selectedModuleIds.has(module.module_id);
            return (
              <label
                key={module.module_id}
                className="grid grid-cols-12 gap-4 p-4 items-center border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors text-sm cursor-pointer"
              >
                <div className="col-span-1">
                  <Checkbox checked={checked} onCheckedChange={() => onToggleModule(module.module_id)} />
                </div>
                <div className="col-span-4 min-w-0">
                  <div className="font-medium text-foreground truncate">{module.module_name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {module.description ?? 'No description available.'}
                  </div>
                </div>
                <div className="col-span-2">
                  <Badge variant="outline">{getModuleTypeLabel(module)}</Badge>
                </div>
                <div className="col-span-3 text-muted-foreground truncate">{module.owner_name ?? 'N/A'}</div>
                <div className="col-span-2 text-right text-muted-foreground">{module.question_count ?? 0}</div>
              </label>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/20 p-3">
      <div className="text-lg font-semibold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ErrorState({ title, error }: { title: string; error: unknown }) {
  return (
    <div className="p-6 space-y-2">
      <p className="text-sm font-medium text-destructive">{title}</p>
      <p className="text-xs text-muted-foreground">
        {error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.'}
      </p>
    </div>
  );
}

function TablePagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-border/50 p-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>{start}-{end} of {total}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 1}>
          Previous
        </Button>
        <span className="min-w-16 text-center font-mono text-foreground">{page} / {pageCount}</span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page === pageCount}>
          Next
        </Button>
      </div>
    </div>
  );
}
