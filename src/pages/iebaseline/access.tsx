import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { ReactNode, useMemo } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { ieBaselineApi, type IEBaselineSystemModule } from './api';
import { useIEBaselineCurrentUser } from './useIEBaselineCurrentUser';

export const IE_BASELINE_ROUTE_PATTERNS = [
  '/iebaseline',
  '/iebaseline/edit',
  '/iebaseline/assign',
  '/iebaseline/assignment-status',
  '/iebaseline/approvals/my-submissions',
  '/iebaseline/approvals/inbox',
  '/iebaseline/approvals/:approvalId/review',
  '/iebaseline/users',
  '/iebaseline/developer-docs',
  '/iebaseline/attempts',
  '/iebaseline/attempts/:attemptId/results',
  '/iebaseline/module/:moduleId/results',
  '/iebaseline/module/:moduleId',
  '/iebaseline/admin/:moduleId',
] as const;

const IETOOLS_PREFIX = '/ietools';

export function normalizeIEBaselineRoutePath(path: string | null | undefined) {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;

  const withoutQuery = trimmed.split(/[?#]/)[0] || '/';
  const withoutTrailingSlash = withoutQuery.length > 1
    ? withoutQuery.replace(/\/+$/, '')
    : withoutQuery;

  if (withoutTrailingSlash === IETOOLS_PREFIX) return '/';
  if (withoutTrailingSlash.startsWith(`${IETOOLS_PREFIX}/`)) {
    return withoutTrailingSlash.slice(IETOOLS_PREFIX.length) || '/';
  }

  return withoutTrailingSlash;
}

export function doesIEBaselineRouteMatch(pattern: string, pathname: string) {
  return Boolean(matchPath({ path: pattern, end: true }, pathname));
}

export function resolveIEBaselineNavTarget(
  item: { to: string; accessPaths?: readonly string[] },
  canView: (path: string) => boolean,
) {
  const candidates = [item.to, ...(item.accessPaths ?? [])];
  const uniqueCandidates = Array.from(new Set(candidates));
  return uniqueCandidates.find((path) => canView(path)) ?? null;
}

function isViewableModule(module: IEBaselineSystemModule) {
  return module.can_view === true && module.is_active !== false && Boolean(module.route_path);
}

export function useIEBaselineRouteAccess(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const currentUser = useIEBaselineCurrentUser({ enabled });
  const userId = currentUser.ieBaselineUserId;

  const modulesQuery = useQuery({
    queryKey: ['iebaseline', 'system-modules', userId],
    queryFn: () => ieBaselineApi.users.systemModules.get(userId!),
    enabled: enabled && Boolean(userId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const routePatterns = useMemo(() => {
    const patterns = (modulesQuery.data?.modules ?? [])
      .filter(isViewableModule)
      .map((module) => normalizeIEBaselineRoutePath(module.route_path))
      .filter((path): path is string => Boolean(path));

    return Array.from(new Set(patterns));
  }, [modulesQuery.data]);

  const canView = (path: string) => {
    const normalized = normalizeIEBaselineRoutePath(path);
    if (!normalized) return false;
    return routePatterns.some((pattern) => doesIEBaselineRouteMatch(pattern, normalized));
  };

  return {
    ...currentUser,
    modules: modulesQuery.data?.modules ?? [],
    routePatterns,
    canView,
    isLoading: enabled && (currentUser.isLoading || modulesQuery.isLoading),
    error: currentUser.error ?? modulesQuery.error ?? null,
  };
}

export function IEBaselineAccessGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const access = useIEBaselineRouteAccess();
  const pathname = normalizeIEBaselineRoutePath(location.pathname) ?? location.pathname;

  if (access.isLoading) return <IEBaselineAccessLoading />;
  if (access.error) return <IEBaselineAccessError error={access.error} />;
  if (!access.canView(pathname)) return <IEBaselineAccessDenied />;

  return <>{children}</>;
}

function IEBaselineAccessLoading() {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking access...
      </div>
    </div>
  );
}

function IEBaselineAccessError({ error }: { error: unknown }) {
  return (
    <div className="mx-auto flex min-h-full max-w-xl items-center justify-center px-6 py-16">
      <Card className="w-full border-destructive/30 bg-destructive/10 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div className="space-y-3">
            <div>
              <h1 className="text-base font-semibold text-foreground">Unable to verify access</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                IE Baseline could not load your module permissions.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {error instanceof Error ? error.message : 'Please try again later.'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function IEBaselineAccessDenied() {
  return (
    <div className="mx-auto flex min-h-full max-w-xl items-center justify-center px-6 py-16">
      <Card className="w-full border-border/60 bg-background/80 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-500" />
          <div className="space-y-4">
            <div>
              <h1 className="text-base font-semibold text-foreground">Access denied</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your role does not have view access for this IE Baseline module.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/iebaseline">Back to IE Baseline</Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
