import { useCurrentUser, type CurrentUserManager } from '@/hooks/useCurrentUser';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { ieBaselineApi, type IEBaselineCurrentUserManager } from './api';

const syncedManagerKeys = new Set<string>();
const inflightManagerSyncs = new Set<string>();

function getUserIdOverride() {
  const raw = import.meta.env.VITE_IEBASELINE_USER_ID_OVERRIDE;
  if (!raw) return null;

  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function toManagerPayload(manager: CurrentUserManager | null): IEBaselineCurrentUserManager | null {
  const email = manager?.email?.trim();
  if (!email) return null;

  return {
    name: manager.name?.trim() || null,
    email,
    position: manager.position?.trim() || null,
  };
}

function syncManagerOnce(userId: number, manager: IEBaselineCurrentUserManager) {
  const key = `${userId}:${manager.email.toLowerCase()}`;
  if (syncedManagerKeys.has(key) || inflightManagerSyncs.has(key)) return;

  inflightManagerSyncs.add(key);
  void ieBaselineApi.users.syncManager(userId, { manager })
    .then(() => {
      syncedManagerKeys.add(key);
    })
    .catch((error) => {
      console.warn('IE Baseline manager sync failed', error);
    })
    .finally(() => {
      inflightManagerSyncs.delete(key);
    });
}

export function useIEBaselineCurrentUser(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { user, error: currentUserError } = useCurrentUser();
  const userIdOverride = getUserIdOverride();
  const managerPayload = useMemo(() => toManagerPayload(user?.manager ?? null), [user?.manager]);

  const missingEmailError = useMemo(() => {
    if (!enabled) return null;
    if (userIdOverride) return null;
    if (!user) return null;
    if (user.email) return null;
    return new Error('IE Baseline requires your Jabil email from current-user lookup before it can resolve your learner profile.');
  }, [enabled, user, userIdOverride]);

  const resolveQuery = useQuery({
    queryKey: ['iebaseline', 'current-user', user?.email, user?.wdId, managerPayload?.email],
    queryFn: () => {
      if (!user?.email) throw new Error('Current user email is required.');
      return ieBaselineApi.users.resolveCurrent({
        name: user.fullName ?? user.email,
        email: user.email,
        position: user.jobTitle,
        department: user.department,
        wd_id: user.wdId,
        ...(managerPayload ? { manager: managerPayload } : {}),
      });
    },
    enabled: enabled && !userIdOverride && Boolean(user?.email),
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!enabled || userIdOverride || !resolveQuery.data?.user_id || !managerPayload) return;
    syncManagerOnce(resolveQuery.data.user_id, managerPayload);
  }, [enabled, userIdOverride, resolveQuery.data?.user_id, managerPayload]);

  const error = !enabled || userIdOverride ? null : currentUserError ?? missingEmailError ?? resolveQuery.error ?? null;

  return {
    user,
    ieBaselineUser: enabled ? resolveQuery.data ?? null : null,
    ieBaselineUserId: enabled ? userIdOverride ?? resolveQuery.data?.user_id ?? null : null,
    isLoading: enabled && !userIdOverride ? (!user && !currentUserError) || resolveQuery.isLoading : false,
    error,
  };
}
