import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ieBaselineApi } from './api';

function getUserIdOverride() {
  const raw = import.meta.env.VITE_IEBASELINE_USER_ID_OVERRIDE;
  if (!raw) return null;

  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function useIEBaselineCurrentUser(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { user, error: currentUserError } = useCurrentUser();
  const userIdOverride = getUserIdOverride();

  const missingEmailError = useMemo(() => {
    if (!enabled) return null;
    if (userIdOverride) return null;
    if (!user) return null;
    if (user.email) return null;
    return new Error('IE Baseline requires your Jabil email from current-user lookup before it can resolve your learner profile.');
  }, [enabled, user, userIdOverride]);

  const resolveQuery = useQuery({
    queryKey: ['iebaseline', 'current-user', user?.email],
    queryFn: () => {
      if (!user?.email) throw new Error('Current user email is required.');
      return ieBaselineApi.users.resolveCurrent({
        name: user.fullName ?? user.email,
        email: user.email,
        position: user.jobTitle,
        department: user.department,
      });
    },
    enabled: enabled && !userIdOverride && Boolean(user?.email),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const error = !enabled || userIdOverride ? null : currentUserError ?? missingEmailError ?? resolveQuery.error ?? null;

  return {
    user,
    ieBaselineUser: enabled ? resolveQuery.data ?? null : null,
    ieBaselineUserId: enabled ? userIdOverride ?? resolveQuery.data?.user_id ?? null : null,
    isLoading: enabled && !userIdOverride ? (!user && !currentUserError) || resolveQuery.isLoading : false,
    error,
  };
}
