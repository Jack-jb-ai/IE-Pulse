import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ClipboardList, Eye, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ieBaselineApi, type IEBaselineAttemptHistoryItem } from './api';
import { useIEBaselineCurrentUser } from './useIEBaselineCurrentUser';

export default function PreviousAttempts() {
  const {
    ieBaselineUserId,
    isLoading: isResolvingCurrentUser,
    error: currentUserResolveError,
  } = useIEBaselineCurrentUser();

  const {
    data: attempts = [],
    isLoading: isLoadingAttempts,
    isError: isAttemptsError,
    error: attemptsError,
  } = useQuery({
    queryKey: ['iebaseline', 'attempts', 'list', ieBaselineUserId],
    queryFn: () => ieBaselineApi.attempts.list(ieBaselineUserId!),
    enabled: Boolean(ieBaselineUserId),
    refetchOnWindowFocus: false,
  });

  const sortedAttempts = useMemo(
    () => [...attempts].sort((left, right) => getAttemptSortTime(right) - getAttemptSortTime(left)),
    [attempts],
  );
  const isLoading = isResolvingCurrentUser || isLoadingAttempts;
  const error = currentUserResolveError ?? attemptsError;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <h1 className="text-xl font-semibold text-foreground">Loading previous attempts...</h1>
        <p className="text-sm text-muted-foreground">Fetching your submitted and completed checklist history.</p>
      </div>
    );
  }

  if (error || isAttemptsError) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Card className="border-destructive/30 bg-destructive/5 p-6">
          <h1 className="text-lg font-semibold text-foreground">Unable to Load Previous Attempts</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.'}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <ClipboardList className="h-6 w-6 text-primary" />
            Previous Attempts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Review submitted, approved, and rejected checklist attempts.</p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/iebaseline">
            <RotateCcw className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden border-border/60 bg-background/70 shadow-sm">
        <div className="grid grid-cols-12 gap-4 border-b border-border/60 bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
          <div className="col-span-4">Module</div>
          <div className="col-span-2">Attempt</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Score</div>
          <div className="col-span-1">Result Date</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        {sortedAttempts.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">No previous attempts are available yet.</div>
        )}

        {sortedAttempts.map((attempt) => (
          <div key={attempt.attemptId} className="grid grid-cols-12 items-center gap-4 border-b border-border/40 px-4 py-4 text-sm last:border-0">
            <div className="col-span-4 min-w-0">
              <p className="truncate font-medium text-foreground">{attempt.moduleName ?? `Module ${attempt.moduleId}`}</p>
              <p className="mt-1 text-xs text-muted-foreground">Module ID: {attempt.moduleId}</p>
            </div>
            <div className="col-span-2 font-medium text-foreground">#{attempt.attemptNo}</div>
            <div className="col-span-2">
              <Badge variant="outline" className={cn('border font-semibold', getResultStatusClass(attempt.resultStatus))}>
                {attempt.resultStatus}
              </Badge>
            </div>
            <div className="col-span-2 font-medium text-foreground">{formatScore(attempt.score)}</div>
            <div className="col-span-1 text-xs text-muted-foreground">{formatDate(getResultDate(attempt))}</div>
            <div className="col-span-1 text-right">
              <Button asChild size="sm" variant="ghost" className="gap-2">
                <Link to={`/iebaseline/attempts/${attempt.attemptId}/results`}>
                  <Eye className="h-4 w-4" />
                  View
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function getAttemptSortTime(attempt: IEBaselineAttemptHistoryItem) {
  const value = getResultDate(attempt) ?? attempt.startedAt;
  if (!value) return 0;

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getResultDate(attempt: IEBaselineAttemptHistoryItem) {
  return attempt.completedAt ?? attempt.submittedAt ?? attempt.lastSavedAt;
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Pending';
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Pending';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getResultStatusClass(status: string | null | undefined) {
  switch (status) {
    case 'APPROVED':
    case 'Passed':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25';
    case 'REJECTED':
    case 'Failed':
      return 'bg-red-500/10 text-red-600 border-red-500/25';
    case 'PENDING':
    case 'IN_PROGRESS':
    case 'Pending':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/25';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}
