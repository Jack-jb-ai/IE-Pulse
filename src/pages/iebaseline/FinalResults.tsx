import { useMemo, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, CalendarCheck, CheckCircle2, ChevronLeft, ClipboardCheck, Loader2, UserCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ieBaselineApi,
  IEBASELINE_DEMO_USER_ID,
  type IEBaselineAttempt,
  type IEBaselineSubmitAttemptResponse,
} from './api';

type ResultsLocationState = {
  submitResult?: IEBaselineSubmitAttemptResponse;
};

export default function FinalResults() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const numericModuleId = Number(moduleId);
  const location = useLocation();
  const state = location.state as ResultsLocationState | null;
  const submittedAttempt = state?.submitResult?.attempt;

  const {
    data: homeData,
    isLoading: isLoadingHome,
    isError: isHomeError,
    error: homeError,
  } = useQuery({
    queryKey: ['iebaseline', 'home', IEBASELINE_DEMO_USER_ID],
    queryFn: () => ieBaselineApi.home.get(IEBASELINE_DEMO_USER_ID),
  });

  const {
    data: attemptHistory = [],
    isLoading: isLoadingAttempts,
    isError: isAttemptsError,
    error: attemptsError,
  } = useQuery({
    queryKey: ['iebaseline', 'modules', numericModuleId, 'attempts'],
    queryFn: () => ieBaselineApi.modules.attempts.list(numericModuleId),
    enabled: Number.isFinite(numericModuleId),
    refetchOnWindowFocus: false,
  });

  const latestStoredAttempt = useMemo(() => getLatestCompletedAttempt(attemptHistory), [attemptHistory]);
  const assignment = homeData?.assignments.find((item) => String(item.module_id) === moduleId);
  const attempt = latestStoredAttempt ?? submittedAttempt;
  const isLoading = isLoadingHome || (isLoadingAttempts && !submittedAttempt);
  const isError = isHomeError || isAttemptsError || !Number.isFinite(numericModuleId);
  const error = homeError ?? attemptsError;
  const resultStyle = getResultStyle(attempt?.resultStatus);
  const ResultIcon = resultStyle.Icon;

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <h1 className="text-xl font-semibold text-foreground">Loading final results...</h1>
        <p className="text-sm text-muted-foreground">Fetching the latest scored checklist attempt.</p>
      </div>
    );
  }

  if (isError) {
    return (
      <ResultsShell moduleId={moduleId}>
        <Card className="mx-auto max-w-2xl border-destructive/30 bg-destructive/5 p-8 text-center">
          <XCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <h1 className="text-2xl font-bold text-foreground">Unable to Load Results</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {!Number.isFinite(numericModuleId)
              ? 'The module ID in the URL is invalid.'
              : error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.'}
          </p>
        </Card>
      </ResultsShell>
    );
  }

  if (!attempt) {
    return (
      <ResultsShell moduleId={moduleId}>
        <Card className="mx-auto max-w-2xl border-border/60 bg-background/70 p-8 text-center shadow-sm">
          <ClipboardCheck className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">No Completed Attempt Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This module does not have a submitted checklist result available yet.
          </p>
        </Card>
      </ResultsShell>
    );
  }

  return (
    <ResultsShell moduleId={moduleId}>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className={cn('overflow-hidden border p-0 shadow-sm', resultStyle.panelClass)}>
          <div className="border-b border-white/40 bg-background/70 p-6 backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <Badge variant="outline" className={cn('w-fit border font-semibold', resultStyle.badgeClass)}>
                  {attempt.resultStatus}
                </Badge>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Final Results</p>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                    {assignment?.module_name ?? `Module ${attempt.moduleId}`}
                  </h1>
                </div>
              </div>
              <div className={cn('flex h-14 w-14 items-center justify-center rounded-md border', resultStyle.iconWrapClass)}>
                <ResultIcon className="h-7 w-7" />
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score</span>
              <div className="mt-2 flex items-end gap-3">
                <span className="text-6xl font-bold tracking-tight text-foreground">{formatScore(attempt.score)}</span>
                <span className="pb-2 text-sm font-medium text-muted-foreground">
                  {attempt.answeredQuestions} / {attempt.totalQuestions} answered
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ResultMetric label="Result" value={attempt.resultStatus} />
              <ResultMetric label="Attempt" value={`#${attempt.attemptNo}`} />
              <ResultMetric label="Completed" value={formatDateTime(getCompletedDate(attempt))} />
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/60 bg-background/70 p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
                <UserCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Learner Details</h2>
                <p className="text-xs text-muted-foreground">Submitted checklist owner</p>
              </div>
            </div>

            <div className="grid gap-3">
              <DetailRow label="Name" value={homeData?.user.name ?? 'N/A'} />
              <DetailRow label="Position" value={homeData?.user.position ?? 'N/A'} />
              <DetailRow label="Date Completed" value={formatDateTime(getCompletedDate(attempt))} />
            </div>
          </Card>

          <Card className="border-border/60 bg-background/70 p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/40">
                <Award className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Checklist Summary</h2>
                <p className="text-xs text-muted-foreground">Backend-scored outcome</p>
              </div>
            </div>

            <div className="grid gap-3">
              <DetailRow label="Score" value={formatScore(attempt.score)} />
              <DetailRow label="Result" value={attempt.resultStatus} />
              <DetailRow label="Correct Answers" value={`${attempt.correctAnswers} / ${attempt.totalQuestions}`} />
            </div>
          </Card>
        </div>
      </div>
    </ResultsShell>
  );
}

function ResultsShell({ moduleId, children }: { moduleId?: string; children: ReactNode }) {
  const returnPath = moduleId ? `/iebaseline/module/${moduleId}` : '/iebaseline';

  return (
    <div className="min-h-full bg-muted/20 px-6 py-8">
      <div className="mx-auto mb-6 max-w-6xl">
        <Button variant="ghost" size="sm" asChild className="gap-2 -ml-3 text-muted-foreground hover:text-foreground">
          <Link to={returnPath}>
            <ChevronLeft className="h-4 w-4" />
            Return to Module
          </Link>
        </Button>
      </div>
      {children}
      <div className="mx-auto mt-6 flex max-w-6xl justify-end">
        <Button asChild className="gap-2">
          <Link to={returnPath}>
            <CalendarCheck className="h-4 w-4" />
            Return to Module
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/60 p-4">
      <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="mt-1 block text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-background/50 px-4 py-3 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-foreground">{value}</span>
    </div>
  );
}

function getLatestCompletedAttempt(attempts: IEBaselineAttempt[]) {
  return attempts
    .filter((attempt) => attempt.attemptStatus === 'Completed' || attempt.attemptStatus === 'Submitted')
    .sort((left, right) => getAttemptSortTime(right) - getAttemptSortTime(left))[0];
}

function getAttemptSortTime(attempt: IEBaselineAttempt) {
  const value = getCompletedDate(attempt) ?? attempt.startedAt;
  if (!value) return 0;

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getCompletedDate(attempt: IEBaselineAttempt) {
  return attempt.completedAt ?? attempt.submittedAt ?? attempt.lastSavedAt;
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Pending';

  return `${Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Pending';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getResultStyle(status: IEBaselineAttempt['resultStatus'] | undefined) {
  switch (status) {
    case 'Passed':
      return {
        Icon: CheckCircle2,
        panelClass: 'border-emerald-500/30 bg-emerald-500/5',
        badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
        iconWrapClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
      };
    case 'Failed':
      return {
        Icon: XCircle,
        panelClass: 'border-destructive/30 bg-destructive/5',
        badgeClass: 'border-destructive/30 bg-destructive/10 text-destructive',
        iconWrapClass: 'border-destructive/30 bg-destructive/10 text-destructive',
      };
    default:
      return {
        Icon: ClipboardCheck,
        panelClass: 'border-amber-500/30 bg-amber-500/5',
        badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
        iconWrapClass: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
      };
  }
}
