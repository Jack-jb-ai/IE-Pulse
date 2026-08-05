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
import { toast } from '@/components/ui/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, RotateCcw, Save, Search, Trash2, UserCheck, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  ieBaselineApi,
  type IEBaselineModule,
  type IEBaselineUser,
} from './api';
import { useIEBaselineCurrentUser } from './useIEBaselineCurrentUser';

export default function AssignModules() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<IEBaselineUser | null>(null);
  const [draftModuleIds, setDraftModuleIds] = useState<Set<number>>(new Set());
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

  const userModulesQuery = useQuery({
    queryKey: ['iebaseline', 'users', selectedUser?.user_id, 'modules', ieBaselineUserId],
    queryFn: () => ieBaselineApi.users.modules.get(selectedUser!.user_id, ieBaselineUserId!),
    enabled: Boolean(selectedUser && ieBaselineUserId),
  });

  useEffect(() => {
    if (!userModulesQuery.data) return;
    setDraftModuleIds(new Set(userModulesQuery.data.assigned_module_ids));
  }, [userModulesQuery.data]);

  const originalModuleIds = useMemo(
    () => new Set(userModulesQuery.data?.assigned_module_ids ?? []),
    [userModulesQuery.data],
  );

  const changes = useMemo(() => {
    const draftIds = Array.from(draftModuleIds);
    const originalIds = Array.from(originalModuleIds);

    return {
      toAdd: draftIds.filter((id) => !originalModuleIds.has(id)),
      toRemove: originalIds.filter((id) => !draftModuleIds.has(id)),
      unchanged: draftIds.filter((id) => originalModuleIds.has(id)),
    };
  }, [draftModuleIds, originalModuleIds]);

  const hasChanges = changes.toAdd.length > 0 || changes.toRemove.length > 0;
  const assignedCount = draftModuleIds.size;

  const updateModulesMutation = useMutation({
    mutationFn: () => {
      if (!ieBaselineUserId) throw new Error('Current IE Baseline user is not resolved yet.');
      return ieBaselineApi.users.modules.update(selectedUser!.user_id, {
        module_ids: Array.from(draftModuleIds).sort((a, b) => a - b),
        assignee_id: ieBaselineUserId,
      }, ieBaselineUserId);
    },
    onSuccess: async (data) => {
      setDraftModuleIds(new Set(data.assigned_module_ids));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'users', selectedUser?.user_id, 'modules'] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'home'] }),
      ]);

      toast({
        title: 'Module assignments updated',
        description: `Added ${data.added_module_ids.length}, removed ${data.removed_module_ids.length}, kept ${data.unchanged_module_ids.length}.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Unable to update assignments',
        description: error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.',
        variant: 'destructive',
      });
    },
  });

  const toggleModule = (moduleId: number) => {
    setDraftModuleIds((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const resetDraft = () => {
    setDraftModuleIds(new Set(originalModuleIds));
  };

  const removeSelected = () => {
    setDraftModuleIds(new Set());
  };

  const closeManager = () => {
    setSelectedUser(null);
    setDraftModuleIds(new Set());
  };

  const manageUser = (user: IEBaselineUser) => {
    setSelectedUser(user);
    setDraftModuleIds(new Set());
  };

  return (
    <div className="space-y-6 px-6 pb-6 pt-32 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 px-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 text-foreground">
            <UserCheck className="w-5 h-5 text-primary" />
            Assign Modules
          </h1>
          <p className="text-sm text-muted-foreground">
            Select a user, then choose the IE Baseline modules assigned to them.
          </p>
        </div>
        {selectedUser && (
          <Button variant="outline" size="sm" onClick={closeManager}>
            Back to Users
          </Button>
        )}
      </div>

      <UserList
        users={usersQuery.data ?? []}
        isLoading={usersQuery.isLoading || isResolvingCurrentUser}
        isError={usersQuery.isError || Boolean(currentUserResolveError)}
        error={currentUserResolveError ?? usersQuery.error}
        selectedUserId={selectedUser?.user_id}
        onManage={manageUser}
      />

      {selectedUser && (
        <ModuleManager
          assignedCount={assignedCount}
          changes={changes}
          draftModuleIds={draftModuleIds}
          hasChanges={hasChanges}
          isLoading={modulesQuery.isLoading || userModulesQuery.isLoading}
          isError={modulesQuery.isError || userModulesQuery.isError}
          error={modulesQuery.error ?? userModulesQuery.error}
          isSaving={updateModulesMutation.isPending}
          canApply={Boolean(ieBaselineUserId)}
          modules={modulesQuery.data ?? []}
          selectedUser={userModulesQuery.data?.user ?? selectedUser}
          onApply={() => updateModulesMutation.mutate()}
          onRemoveSelected={removeSelected}
          onReset={resetDraft}
          onToggleModule={toggleModule}
        />
      )}
    </div>
  );
}

interface UserListProps {
  users: IEBaselineUser[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  selectedUserId?: number;
  onManage: (user: IEBaselineUser) => void;
}

function UserList({ users, isLoading, isError, error, selectedUserId, onManage }: UserListProps) {
  return (
    <Card className="border-border/50 bg-background/40 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 p-4">
        <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2 text-foreground">
          <Users className="w-4 h-4 text-primary" />
          Users
        </h2>
        <Badge variant="outline">{users.length} total</Badge>
      </div>

      <div className="grid grid-cols-12 gap-4 p-4 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div className="col-span-4">Name</div>
        <div className="col-span-3">Position</div>
        <div className="col-span-2">WD ID</div>
        <div className="col-span-2">Assigned</div>
        <div className="col-span-1 text-right">Action</div>
      </div>

      {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading users...</div>}

      {isError && (
        <div className="p-6 space-y-2">
          <p className="text-sm font-medium text-destructive">Unable to load users.</p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.'}
          </p>
        </div>
      )}

      {!isLoading && !isError && users.length === 0 && (
        <div className="p-6 text-sm text-muted-foreground">No users are available for assignment.</div>
      )}

      {!isLoading && !isError && users.length > 0 && (
        <div className="flex flex-col">
          {users.map((user) => {
            const isSelected = user.user_id === selectedUserId;
            return (
              <div
                key={user.user_id}
                className={`grid grid-cols-12 gap-4 p-4 items-center border-b border-border/50 last:border-0 text-sm transition-colors ${
                  isSelected ? 'bg-primary/5' : 'hover:bg-muted/10'
                }`}
              >
                <div className="col-span-4">
                  <div className="font-medium text-foreground">{user.name}</div>
                  <div className="text-xs text-muted-foreground">User ID: {user.user_id}</div>
                </div>
                <div className="col-span-3 text-muted-foreground">{user.position ?? 'N/A'}</div>
                <div className="col-span-2 text-muted-foreground">{user.wd_id ?? 'N/A'}</div>
                <div className="col-span-2">
                  <Badge variant="outline">{user.assigned_module_count ?? 0} modules</Badge>
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button size="sm" variant={isSelected ? 'secondary' : 'outline'} onClick={() => onManage(user)}>
                    Manage
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

interface ModuleManagerProps {
  assignedCount: number;
  changes: {
    toAdd: number[];
    toRemove: number[];
    unchanged: number[];
  };
  draftModuleIds: Set<number>;
  hasChanges: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isSaving: boolean;
  canApply: boolean;
  modules: IEBaselineModule[];
  selectedUser: {
    user_id: number;
    name: string;
    position: string | null;
    wd_id: number | null;
  };
  onApply: () => void;
  onRemoveSelected: () => void;
  onReset: () => void;
  onToggleModule: (moduleId: number) => void;
}

function ModuleManager({
  assignedCount,
  changes,
  draftModuleIds,
  hasChanges,
  isLoading,
  isError,
  error,
  isSaving,
  canApply,
  modules,
  selectedUser,
  onApply,
  onRemoveSelected,
  onReset,
  onToggleModule,
}: ModuleManagerProps) {
  return (
    <Card className="border-border/50 bg-background/40 backdrop-blur-sm overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2 text-foreground">
            <BookOpen className="w-4 h-4 text-primary" />
            Manage Modules for {selectedUser.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {selectedUser.position ?? 'No position'} - WD ID: {selectedUser.wd_id ?? 'N/A'} - {assignedCount} selected
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={onReset} disabled={!hasChanges || isSaving}>
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={onRemoveSelected}
            disabled={assignedCount === 0 || isSaving}
          >
            <Trash2 className="w-4 h-4" />
            Remove selected
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="gap-2" disabled={!hasChanges || isSaving || isLoading || isError || !canApply}>
                <Save className="w-4 h-4" />
                Apply changes
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apply module assignment changes?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will update assignments for {selectedUser.name}. Added modules start as Incomplete, removed
                  modules will no longer appear on the learner home page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-md border border-border/50 bg-muted/20 p-3">
                  <div className="text-lg font-semibold text-foreground">{changes.toAdd.length}</div>
                  <div className="text-xs text-muted-foreground">Add</div>
                </div>
                <div className="rounded-md border border-border/50 bg-muted/20 p-3">
                  <div className="text-lg font-semibold text-foreground">{changes.toRemove.length}</div>
                  <div className="text-xs text-muted-foreground">Remove</div>
                </div>
                <div className="rounded-md border border-border/50 bg-muted/20 p-3">
                  <div className="text-lg font-semibold text-foreground">{changes.unchanged.length}</div>
                  <div className="text-xs text-muted-foreground">Keep</div>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onApply} disabled={isSaving || !canApply}>
                  {isSaving ? 'Applying...' : 'Confirm apply'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 p-4 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div className="col-span-1">Assign</div>
        <div className="col-span-5">Module</div>
        <div className="col-span-3">Owner</div>
        <div className="col-span-2">Questions</div>
        <div className="col-span-1 text-right">Status</div>
      </div>

      {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading modules...</div>}

      {isError && (
        <div className="p-6 space-y-2">
          <p className="text-sm font-medium text-destructive">Unable to load module assignments.</p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.'}
          </p>
        </div>
      )}

      {!isLoading && !isError && modules.length === 0 && (
        <div className="p-6 text-sm text-muted-foreground">No modules are available in the database.</div>
      )}

      {!isLoading && !isError && modules.length > 0 && (
        <div className="flex flex-col">
          {modules.map((module) => {
            const checked = draftModuleIds.has(module.module_id);
            return (
              <label
                key={module.module_id}
                className="grid grid-cols-12 gap-4 p-4 items-center border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors text-sm cursor-pointer"
              >
                <div className="col-span-1">
                  <Checkbox checked={checked} onCheckedChange={() => onToggleModule(module.module_id)} />
                </div>
                <div className="col-span-5 min-w-0">
                  <div className="font-medium text-foreground truncate">{module.module_name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {module.description ?? 'No description available.'}
                  </div>
                </div>
                <div className="col-span-3 text-muted-foreground truncate">{module.owner_name ?? 'N/A'}</div>
                <div className="col-span-2 text-muted-foreground">{module.question_count ?? 0}</div>
                <div className="col-span-1 text-right">
                  {checked ? (
                    <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">
                      Assigned
                    </Badge>
                  ) : (
                    <Badge variant="outline">Open</Badge>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {!isLoading && !isError && modules.length > 0 && !hasChanges && (
        <div className="flex items-center gap-2 border-t border-border/50 p-4 text-xs text-muted-foreground">
          <Search className="w-4 h-4" />
          No unsaved assignment changes.
        </div>
      )}
    </Card>
  );
}
