import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ieBaselineApi } from './api';

export function useIEBaselineCurrentUser() {
  const { user, error: currentUserError } = useCurrentUser();

  const missingEmailError = useMemo(() => {
    if (!user) return null;
    if (user.email) return null;
    return new Error('IE Baseline requires your Jabil email from current-user lookup before it can resolve your learner profile.');
  }, [user]);

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
    enabled: Boolean(user?.email),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const error = currentUserError ?? missingEmailError ?? resolveQuery.error ?? null;

  return {
    user,
    ieBaselineUser: resolveQuery.data ?? null,
    ieBaselineUserId: resolveQuery.data?.user_id ?? null,
    isLoading: (!user && !currentUserError) || resolveQuery.isLoading,
    error,
  };
}
