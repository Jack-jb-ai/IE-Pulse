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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from '@/components/ui/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CheckSquare, Loader2, Pencil, RotateCcw, Save, Search, UserCheck, Users } from 'lucide-react';
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

export function getModuleAssignmentChanges(draftModuleIds: Set<number>, originalModuleIds: Set<number>) {
  const draftIds = Array.from(draftModuleIds);
  const originalIds = Array.from(originalModuleIds);

  return {
    toAdd: draftIds.filter((id) => !originalModuleIds.has(id)),
    toRemove: originalIds.filter((id) => !draftModuleIds.has(id)),
    unchanged: draftIds.filter((id) => originalModuleIds.has(id)),
  };
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
  const [editingUser, setEditingUser] = useState<IEBaselineUser | null>(null);
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
      setSelectedUserIds(new Set());
      setSelectedModuleIds(new Set());

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

  const clearSelections = () => {
    setSelectedUserIds(new Set());
    setSelectedModuleIds(new Set());
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

        {(selectedUserIds.size > 0 || selectedModuleIds.size > 0) && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={clearSelections} disabled={bulkAddMutation.isPending}>
              Clear selections
            </Button>
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
          onEditUser={setEditingUser}
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

      <EditUserModulesDialog
        currentUserId={ieBaselineUserId}
        modules={modules}
        user={editingUser}
        onClose={() => setEditingUser(null)}
      />
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
  onEditUser: (user: IEBaselineUser) => void;
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
  onEditUser,
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
        <div className="col-span-3">Name</div>
        <div className="col-span-2">Position</div>
        <div className="col-span-2">WD ID</div>
        <div className="col-span-2 text-right">Assigned</div>
        <div className="col-span-2 text-right">Action</div>
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
              <div
                key={user.user_id}
                className="grid grid-cols-12 gap-4 p-4 items-center border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors text-sm cursor-pointer"
              >
                <div className="col-span-1">
                  <Checkbox checked={checked} onCheckedChange={() => onToggleUser(user.user_id)} />
                </div>
                <div className="col-span-3 min-w-0">
                  <div className="font-medium text-foreground truncate">{user.name}</div>
                </div>
                <div className="col-span-2 text-muted-foreground truncate">{user.position ?? 'N/A'}</div>
                <div className="col-span-2 text-muted-foreground">{user.wd_id ?? 'N/A'}</div>
                <div className="col-span-2 text-right">
                  <Badge variant="outline">{user.assigned_module_count ?? 0}</Badge>
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => onEditUser(user)}>
                    <Pencil className="h-4 w-4" />
                    Edit Modules
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TablePagination page={page} pageCount={pageCount} total={filteredCount} pageSize={USER_PAGE_SIZE} onPageChange={onPageChange} />
    </Card>
  );
}

function EditUserModulesDialog({
  currentUserId,
  modules,
  user,
  onClose,
}: {
  currentUserId: number | null;
  modules: IEBaselineModule[];
  user: IEBaselineUser | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [draftModuleIds, setDraftModuleIds] = useState<Set<number>>(new Set());
  const [editSearch, setEditSearch] = useState('');
  const [editModuleType, setEditModuleType] = useState(MODULE_TYPE_ALL);

  const userModulesQuery = useQuery({
    queryKey: ['iebaseline', 'users', user?.user_id, 'modules', currentUserId],
    queryFn: () => ieBaselineApi.users.modules.get(user!.user_id, currentUserId!),
    enabled: Boolean(user && currentUserId),
  });

  useEffect(() => {
    setDraftModuleIds(new Set());
    setEditSearch('');
    setEditModuleType(MODULE_TYPE_ALL);
  }, [user?.user_id]);

  useEffect(() => {
    if (userModulesQuery.data) {
      setDraftModuleIds(new Set(userModulesQuery.data.assigned_module_ids));
    }
  }, [userModulesQuery.data]);

  const originalModuleIds = useMemo(
    () => new Set(userModulesQuery.data?.assigned_module_ids ?? []),
    [userModulesQuery.data],
  );
  const changes = useMemo(
    () => getModuleAssignmentChanges(draftModuleIds, originalModuleIds),
    [draftModuleIds, originalModuleIds],
  );
  const hasChanges = changes.toAdd.length > 0 || changes.toRemove.length > 0;
  const moduleTypeOptions = useMemo(() => getUniqueModuleTypes(modules), [modules]);
  const filteredModules = useMemo(
    () => filterAssignableModules(modules, editSearch, editModuleType),
    [modules, editSearch, editModuleType],
  );

  const updateModulesMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('Select a user before editing modules.');
      if (!currentUserId) throw new Error('Current IE Baseline user is not resolved yet.');

      return ieBaselineApi.users.modules.update(user.user_id, {
        module_ids: Array.from(draftModuleIds).sort((a, b) => a - b),
        assignee_id: currentUserId,
      }, currentUserId);
    },
    onSuccess: async (data) => {
      setDraftModuleIds(new Set(data.assigned_module_ids));

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'modules'] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'users', user?.user_id, 'modules'] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'home'] }),
      ]);

      toast({
        title: 'Module assignments saved',
        description: `Added ${data.added_module_ids.length}, removed ${data.removed_module_ids.length}, kept ${data.unchanged_module_ids.length}.`,
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Unable to save module assignments',
        description: error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.',
        variant: 'destructive',
      });
    },
  });

  const toggleDraftModule = (moduleId: number) => {
    setDraftModuleIds((current) => toggleSingleSelection(current, moduleId));
  };

  const resetDraft = () => {
    setDraftModuleIds(new Set(originalModuleIds));
  };

  const closeSheet = () => {
    if (!updateModulesMutation.isPending) onClose();
  };

  return (
    <Sheet open={Boolean(user)} onOpenChange={(open) => {
      if (!open) closeSheet();
    }}>
      <SheetContent side="right" className="flex h-screen w-full max-w-none flex-col gap-0 p-0 sm:w-[92vw] sm:max-w-[920px]">
        <SheetHeader className="shrink-0 border-b border-border/50 px-5 py-4 pr-12">
          <SheetTitle>Edit Modules{user ? ` for ${user.name}` : ''}</SheetTitle>
          <SheetDescription>
            Review and replace this user's assigned modules. Removed modules will no longer appear on the learner home page.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={editSearch}
                onChange={(event) => setEditSearch(event.target.value)}
                placeholder="Search module name"
                className="pl-9"
              />
            </div>
            <Select value={editModuleType} onValueChange={setEditModuleType}>
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

          <div className="grid gap-3 sm:grid-cols-4">
            <SummaryTile label="Selected" value={draftModuleIds.size} />
            <SummaryTile label="Add" value={changes.toAdd.length} />
            <SummaryTile label="Remove" value={changes.toRemove.length} />
            <SummaryTile label="Keep" value={changes.unchanged.length} />
          </div>

          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/50 bg-background/40">
            <div className="shrink-0 grid grid-cols-12 gap-4 border-b border-border/50 bg-background p-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <div className="col-span-1">Assign</div>
              <div className="col-span-5">Module</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Owner</div>
              <div className="col-span-2 text-right">Questions</div>
            </div>

            {userModulesQuery.isLoading && <div className="p-6 text-sm text-muted-foreground">Loading assigned modules...</div>}
            {userModulesQuery.isError && <ErrorState title="Unable to load assigned modules." error={userModulesQuery.error} />}
            {!userModulesQuery.isLoading && !userModulesQuery.isError && filteredModules.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">No modules match the current filters.</div>
            )}
            {!userModulesQuery.isLoading && !userModulesQuery.isError && filteredModules.length > 0 && (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {filteredModules.map((module) => {
                  const checked = draftModuleIds.has(module.module_id);
                  return (
                    <label
                      key={module.module_id}
                      className="grid grid-cols-12 items-center gap-4 border-b border-border/50 p-3 text-sm transition-colors last:border-0 hover:bg-muted/10 cursor-pointer"
                    >
                      <div className="col-span-1">
                        <Checkbox checked={checked} onCheckedChange={() => toggleDraftModule(module.module_id)} />
                      </div>
                      <div className="col-span-5 min-w-0">
                        <div className="font-medium text-foreground truncate">{module.module_name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {module.description ?? 'No description available.'}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <Badge variant="outline">{getModuleTypeLabel(module)}</Badge>
                      </div>
                      <div className="col-span-2 text-muted-foreground truncate">{module.owner_name ?? 'N/A'}</div>
                      <div className="col-span-2 text-right text-muted-foreground">{module.question_count ?? 0}</div>
                    </label>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <SheetFooter className="shrink-0 border-t border-border/50 px-5 py-4">
          <Button variant="outline" className="gap-2" onClick={resetDraft} disabled={!hasChanges || updateModulesMutation.isPending || userModulesQuery.isLoading}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="gap-2" disabled={!hasChanges || updateModulesMutation.isPending || userModulesQuery.isLoading || userModulesQuery.isError}>
                {updateModulesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Save module changes?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will replace {user?.name ?? 'this user'}'s module assignment set. Removed modules will no longer appear on the learner home page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid grid-cols-3 gap-3 text-center">
                <SummaryTile label="Add" value={changes.toAdd.length} />
                <SummaryTile label="Remove" value={changes.toRemove.length} />
                <SummaryTile label="Keep" value={changes.unchanged.length} />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={updateModulesMutation.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => updateModulesMutation.mutate()} disabled={updateModulesMutation.isPending}>
                  {updateModulesMutation.isPending ? 'Saving...' : 'Confirm save'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
