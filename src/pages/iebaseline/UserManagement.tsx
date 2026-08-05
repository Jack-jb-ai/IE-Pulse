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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  UserCog,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ieBaselineApi,
  type IEBaselineDeletePreview,
  type IEBaselineRole,
  type IEBaselineUserPayload,
  type IEBaselineUserProfile,
} from './api';
import { useIEBaselineCurrentUser } from './useIEBaselineCurrentUser';

const FALLBACK_ROLES: IEBaselineRole[] = [
  { role_id: 1, role_name: 'user' },
  { role_id: 2, role_name: 'admin' },
  { role_id: 3, role_name: 'dev' },
];

interface UserFormState {
  name: string;
  position: string;
  wd_id: string;
  email: string;
  department: string;
  role_id: string;
  reports_to: number | null;
}

const emptyForm: UserFormState = {
  name: '',
  position: '',
  wd_id: '',
  email: '',
  department: '',
  role_id: '1',
  reports_to: null,
};

export default function UserManagement() {
  const queryClient = useQueryClient();
  const {
    ieBaselineUserId,
    isLoading: isResolvingCurrentUser,
    error: currentUserResolveError,
  } = useIEBaselineCurrentUser();
  const rolesQuery = useQuery({
    queryKey: ['iebaseline', 'roles', ieBaselineUserId],
    queryFn: () => ieBaselineApi.roles.list(ieBaselineUserId!),
    enabled: Boolean(ieBaselineUserId),
    retry: false,
  });

  const roles = rolesQuery.data?.length ? rolesQuery.data : FALLBACK_ROLES;

  const invalidateUsers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['iebaseline', 'users'] }),
      queryClient.invalidateQueries({ queryKey: ['iebaseline', 'user-search'] }),
    ]);
  };

  return (
    <div className="space-y-6 px-6 pb-6 pt-32 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 px-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 text-foreground">
            <UserCog className="w-5 h-5 text-primary" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Create, update, and remove IE Baseline users from user_master.
          </p>
        </div>
        {(rolesQuery.isError || currentUserResolveError) && (
          <Badge variant="outline" className="w-fit text-amber-600 border-amber-500/30 bg-amber-500/10">
            Using default roles
          </Badge>
        )}
      </div>

      <Tabs defaultValue="create" className="space-y-4">
        <TabsList>
          <TabsTrigger value="create" className="gap-2">
            <Plus className="h-4 w-4" />
            Create User
          </TabsTrigger>
          <TabsTrigger value="update" className="gap-2">
            <Save className="h-4 w-4" />
            Update User
          </TabsTrigger>
          <TabsTrigger value="delete" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Delete User
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <CreateUserPanel roles={roles} currentUserId={ieBaselineUserId} onUsersChanged={invalidateUsers} />
        </TabsContent>

        <TabsContent value="update">
          <UpdateUserPanel roles={roles} currentUserId={ieBaselineUserId} isResolvingCurrentUser={isResolvingCurrentUser} onUsersChanged={invalidateUsers} />
        </TabsContent>

        <TabsContent value="delete">
          <DeleteUserPanel currentUserId={ieBaselineUserId} isResolvingCurrentUser={isResolvingCurrentUser} onUsersChanged={invalidateUsers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateUserPanel({
  roles,
  currentUserId,
  onUsersChanged,
}: {
  roles: IEBaselineRole[];
  currentUserId: number | null;
  onUsersChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [manager, setManager] = useState<IEBaselineUserProfile | null>(null);

  const createMutation = useMutation({
    mutationFn: () => ieBaselineApi.users.create(toPayload(form)),
    onSuccess: async (user) => {
      setForm(emptyForm);
      setManager(null);
      await onUsersChanged();
      toast({
        title: 'User created',
        description: `${user.name} was added to IE Baseline.`,
      });
    },
    onError: showUserMutationError('Unable to create user'),
  });

  const canSubmit = form.name.trim().length > 0 && !createMutation.isPending;

  return (
    <Card className="border-border/50 bg-background/40 backdrop-blur-sm p-6">
      <UserForm
        title="Create User"
        description="Add a user profile for assignments, checklist attempts, and reporting lines."
        form={form}
        roles={roles}
        manager={manager}
        managerExcludeUserId={null}
        currentUserId={currentUserId}
        isSaving={createMutation.isPending}
        submitLabel="Create user"
        onChange={setForm}
        onManagerChange={(next) => {
          setManager(next);
          setForm((current) => ({ ...current, reports_to: next?.user_id ?? null }));
        }}
        onSubmit={() => createMutation.mutate()}
        onReset={() => {
          setForm(emptyForm);
          setManager(null);
        }}
        canSubmit={canSubmit}
      />
    </Card>
  );
}

function UpdateUserPanel({
  roles,
  currentUserId,
  isResolvingCurrentUser,
  onUsersChanged,
}: {
  roles: IEBaselineRole[];
  currentUserId: number | null;
  isResolvingCurrentUser: boolean;
  onUsersChanged: () => Promise<void>;
}) {
  const [selectedUser, setSelectedUser] = useState<IEBaselineUserProfile | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [manager, setManager] = useState<IEBaselineUserProfile | null>(null);

  const userQuery = useQuery({
    queryKey: ['iebaseline', 'users', selectedUser?.user_id, currentUserId],
    queryFn: () => ieBaselineApi.users.get(selectedUser!.user_id, currentUserId!),
    enabled: Boolean(selectedUser && currentUserId),
  });

  useEffect(() => {
    if (!userQuery.data) return;
    setForm(fromProfile(userQuery.data));
    if (userQuery.data.reports_to) {
      setManager({
        user_id: userQuery.data.reports_to,
        name: userQuery.data.reports_to_name ?? `User ${userQuery.data.reports_to}`,
        position: null,
        wd_id: null,
        email: null,
        department: null,
        role_id: 1,
        reports_to: null,
      });
    } else {
      setManager(null);
    }
  }, [userQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!currentUserId) throw new Error('Current IE Baseline user is not resolved yet.');
      return ieBaselineApi.users.update(selectedUser!.user_id, toPayload(form), currentUserId);
    },
    onSuccess: async (user) => {
      setSelectedUser(user);
      setForm(fromProfile(user));
      await onUsersChanged();
      toast({
        title: 'User updated',
        description: `${user.name} was saved.`,
      });
    },
    onError: showUserMutationError('Unable to update user'),
  });

  const canSubmit = Boolean(selectedUser && currentUserId) && form.name.trim().length > 0 && !updateMutation.isPending && !userQuery.isLoading;

  return (
    <div className="space-y-4">
      <Card className="border-border/50 bg-background/40 backdrop-blur-sm p-4">
        <div className="space-y-2">
          <Label>Select user to update</Label>
          <UserSearchCombobox
            value={selectedUser}
            placeholder="Search by name, WD ID, or email"
            currentUserId={currentUserId}
            onChange={setSelectedUser}
          />
        </div>
      </Card>

      {selectedUser && (
        <Card className="border-border/50 bg-background/40 backdrop-blur-sm p-6">
          {isResolvingCurrentUser || userQuery.isLoading ? (
            <LoadingState label="Loading user profile..." />
          ) : userQuery.isError ? (
            <ErrorState title="Unable to load user profile" error={userQuery.error} />
          ) : (
            <UserForm
              title="Update User"
              description={`Editing ${userQuery.data?.name ?? selectedUser.name}.`}
              form={form}
              roles={roles}
              manager={manager}
              managerExcludeUserId={selectedUser.user_id}
              currentUserId={currentUserId}
              isSaving={updateMutation.isPending}
              submitLabel="Save changes"
              onChange={setForm}
              onManagerChange={(next) => {
                setManager(next);
                setForm((current) => ({ ...current, reports_to: next?.user_id ?? null }));
              }}
              onSubmit={() => updateMutation.mutate()}
              onReset={() => {
                if (userQuery.data) {
                  setForm(fromProfile(userQuery.data));
                  if (userQuery.data.reports_to) {
                    setManager({
                      user_id: userQuery.data.reports_to,
                      name: userQuery.data.reports_to_name ?? `User ${userQuery.data.reports_to}`,
                      position: null,
                      wd_id: null,
                      email: null,
                      department: null,
                      role_id: 1,
                      reports_to: null,
                    });
                  } else {
                    setManager(null);
                  }
                }
              }}
              canSubmit={canSubmit}
            />
          )}
        </Card>
      )}
    </div>
  );
}

function DeleteUserPanel({
  currentUserId,
  isResolvingCurrentUser,
  onUsersChanged,
}: {
  currentUserId: number | null;
  isResolvingCurrentUser: boolean;
  onUsersChanged: () => Promise<void>;
}) {
  const [selectedUser, setSelectedUser] = useState<IEBaselineUserProfile | null>(null);
  const deletePreviewQuery = useQuery({
    queryKey: ['iebaseline', 'users', selectedUser?.user_id, 'delete-preview', currentUserId],
    queryFn: () => ieBaselineApi.users.deletePreview(selectedUser!.user_id, currentUserId!),
    enabled: Boolean(selectedUser && currentUserId),
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!currentUserId) throw new Error('Current IE Baseline user is not resolved yet.');
      return ieBaselineApi.users.remove(selectedUser!.user_id, currentUserId);
    },
    onSuccess: async (data) => {
      setSelectedUser(null);
      await onUsersChanged();
      toast({
        title: 'User deleted',
        description: `User ID ${data.user_id} was removed.`,
      });
    },
    onError: showUserMutationError('Unable to delete user'),
  });

  return (
    <div className="space-y-4">
      <Card className="border-border/50 bg-background/40 backdrop-blur-sm p-4">
        <div className="space-y-2">
          <Label>Select user to delete</Label>
          <UserSearchCombobox
            value={selectedUser}
            placeholder="Search by name, WD ID, or email"
            currentUserId={currentUserId}
            onChange={setSelectedUser}
          />
        </div>
      </Card>

      {selectedUser && (
        <Card className="border-border/50 bg-background/40 backdrop-blur-sm overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{selectedUser.name}</h2>
              <p className="text-xs text-muted-foreground">
                {selectedUser.email ?? 'No email'} - WD ID: {selectedUser.wd_id ?? 'N/A'}
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  disabled={deleteMutation.isPending || !currentUserId}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete user
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedUser.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the user record. The backend may block deletion when related records exist.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <DeletePreview preview={deletePreviewQuery.data} isLoading={deletePreviewQuery.isLoading || isResolvingCurrentUser} />
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleteMutation.isPending || !currentUserId}
                    onClick={() => deleteMutation.mutate()}
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Confirm delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {(isResolvingCurrentUser || deletePreviewQuery.isLoading) && <LoadingState label="Checking related records..." />}
          {deletePreviewQuery.isError && (
            <div className="p-4">
              <ErrorState title="Unable to load delete preview" error={deletePreviewQuery.error} />
            </div>
          )}
          {deletePreviewQuery.data && (
            <div className="p-4">
              <DeletePreview preview={deletePreviewQuery.data} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function UserForm({
  title,
  description,
  form,
  roles,
  manager,
  managerExcludeUserId,
  currentUserId,
  isSaving,
  submitLabel,
  canSubmit,
  onChange,
  onManagerChange,
  onSubmit,
  onReset,
}: {
  title: string;
  description: string;
  form: UserFormState;
  roles: IEBaselineRole[];
  manager: IEBaselineUserProfile | null;
  managerExcludeUserId: number | null;
  currentUserId: number | null;
  isSaving: boolean;
  submitLabel: string;
  canSubmit: boolean;
  onChange: (form: UserFormState) => void;
  onManagerChange: (user: IEBaselineUserProfile | null) => void;
  onSubmit: () => void;
  onReset: () => void;
}) {
  const updateField = (key: keyof UserFormState, value: string) => {
    onChange({ ...form, [key]: value });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" disabled={isSaving} onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button size="sm" className="gap-2" disabled={!canSubmit} onClick={onSubmit}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {submitLabel}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Name" required>
          <Input value={form.name} onChange={(event) => updateField('name', event.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
        </Field>
        <Field label="Position">
          <Input value={form.position} onChange={(event) => updateField('position', event.target.value)} />
        </Field>
        <Field label="Department">
          <Input value={form.department} onChange={(event) => updateField('department', event.target.value)} />
        </Field>
        <Field label="WD ID">
          <Input
            inputMode="numeric"
            value={form.wd_id}
            onChange={(event) => updateField('wd_id', event.target.value.replace(/[^\d]/g, ''))}
          />
        </Field>
        <Field label="Role">
          <Select value={form.role_id} onValueChange={(value) => updateField('role_id', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.role_id} value={String(role.role_id)}>
                  {role.role_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Reports To">
            <UserSearchCombobox
              value={manager}
              placeholder="Search manager by name, WD ID, or email"
              excludeUserId={managerExcludeUserId}
              currentUserId={currentUserId}
              onChange={onManagerChange}
              allowClear
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function UserSearchCombobox({
  value,
  placeholder,
  excludeUserId,
  currentUserId,
  allowClear,
  onChange,
}: {
  value: IEBaselineUserProfile | null;
  placeholder: string;
  excludeUserId?: number | null;
  currentUserId: number | null;
  allowClear?: boolean;
  onChange: (user: IEBaselineUserProfile | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const usersQuery = useQuery({
    queryKey: ['iebaseline', 'user-search', search, excludeUserId ?? null, currentUserId],
    queryFn: () => ieBaselineApi.users.search(search, { limit: 25, excludeUserId }, currentUserId!),
    enabled: open && Boolean(currentUserId),
  });

  const users = usersQuery.data ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between gap-2 font-normal"
          disabled={!currentUserId}
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value ? formatUserLabel(value) : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={placeholder} />
          <CommandList>
            {usersQuery.isLoading && <div className="p-3 text-sm text-muted-foreground">Searching users...</div>}
            {usersQuery.isError && <div className="p-3 text-sm text-destructive">Unable to search users.</div>}
            {!usersQuery.isLoading && !usersQuery.isError && <CommandEmpty>No users found.</CommandEmpty>}
            <CommandGroup>
              {allowClear && value && (
                <CommandItem
                  value="clear-selection"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear selection
                </CommandItem>
              )}
              {users.map((user) => (
                <CommandItem
                  key={user.user_id}
                  value={`${user.name} ${user.wd_id ?? ''} ${user.email ?? ''}`}
                  onSelect={() => {
                    onChange(user);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value?.user_id === user.user_id ? 'opacity-100' : 'opacity-0')} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{user.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      WD ID: {user.wd_id ?? 'N/A'} - {user.email ?? 'No email'}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DeletePreview({ preview, isLoading }: { preview?: IEBaselineDeletePreview; isLoading?: boolean }) {
  if (isLoading) return <LoadingState label="Checking delete impact..." />;
  if (!preview) return null;

  const relatedCounts = Object.entries(preview.related_counts ?? {});

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'flex items-start gap-3 rounded-md border p-3',
          preview.can_delete
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-700',
        )}
      >
        {preview.can_delete ? <Check className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
        <div className="space-y-1">
          <div className="text-sm font-medium">
            {preview.can_delete ? 'Backend expects this delete to succeed.' : 'Backend may block this delete.'}
          </div>
          {preview.blocking_reasons.length > 0 && (
            <div className="text-xs">{preview.blocking_reasons.join(', ')}</div>
          )}
        </div>
      </div>
      {relatedCounts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {relatedCounts.map(([key, count]) => (
            <div key={key} className="rounded-md border border-border/50 bg-muted/20 p-3">
              <div className="text-lg font-semibold text-foreground">{count}</div>
              <div className="text-xs capitalize text-muted-foreground">{key.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function ErrorState({ title, error }: { title: string; error: unknown }) {
  return (
    <div className="space-y-1 rounded-md border border-destructive/30 bg-destructive/10 p-4">
      <div className="text-sm font-medium text-destructive">{title}</div>
      <div className="text-xs text-muted-foreground">
        {error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.'}
      </div>
    </div>
  );
}

function fromProfile(user: IEBaselineUserProfile): UserFormState {
  return {
    name: user.name ?? '',
    position: user.position ?? '',
    wd_id: user.wd_id == null ? '' : String(user.wd_id),
    email: user.email ?? '',
    department: user.department ?? '',
    role_id: String(user.role_id ?? 1),
    reports_to: user.reports_to ?? null,
  };
}

function toPayload(form: UserFormState): IEBaselineUserPayload {
  return {
    name: form.name.trim(),
    position: nullableString(form.position),
    wd_id: form.wd_id.trim() ? Number(form.wd_id.trim()) : null,
    reports_to: form.reports_to,
    email: nullableString(form.email),
    department: nullableString(form.department),
    role_id: form.role_id ? Number(form.role_id) : 1,
  };
}

function nullableString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatUserLabel(user: IEBaselineUserProfile) {
  const details = [user.wd_id ? `WD ${user.wd_id}` : null, user.email].filter(Boolean).join(' - ');
  return details ? `${user.name} (${details})` : user.name;
}

function showUserMutationError(title: string) {
  return (error: unknown) => {
    toast({
      title,
      description: error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.',
      variant: 'destructive',
    });
  };
}
