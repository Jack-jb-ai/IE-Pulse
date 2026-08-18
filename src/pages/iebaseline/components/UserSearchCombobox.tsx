import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ieBaselineApi, type IEBaselineUserProfile } from '../api';

interface UserSearchComboboxProps {
  value: IEBaselineUserProfile | null;
  placeholder: string;
  excludeUserId?: number | null;
  roleId?: number | null;
  currentUserId: number | null;
  allowClear?: boolean;
  onChange: (user: IEBaselineUserProfile | null) => void;
}

export default function UserSearchCombobox({
  value,
  placeholder,
  excludeUserId,
  roleId,
  currentUserId,
  allowClear,
  onChange,
}: UserSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const usersQuery = useQuery({
    queryKey: ['iebaseline', 'user-search', search, excludeUserId ?? null, roleId ?? null, currentUserId],
    queryFn: () => ieBaselineApi.users.search(search, { limit: 25, excludeUserId, roleId }, currentUserId!),
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

function formatUserLabel(user: IEBaselineUserProfile) {
  const details = [user.wd_id ? `WD ${user.wd_id}` : null, user.email].filter(Boolean).join(' - ');
  return details ? `${user.name} (${details})` : user.name;
}
