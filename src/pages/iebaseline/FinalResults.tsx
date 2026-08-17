import { useMemo, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, CalendarCheck, CheckCircle2, ChevronLeft, ClipboardCheck, Loader2, UserCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ieBaselineApi,
  type IEBaselineAttempt,
  type IEBaselineAttemptQuestion,
  type IEBaselineSubmitAttemptResponse,
} from './api';
import { useIEBaselineCurrentUser } from './useIEBaselineCurrentUser';

type ResultsLocationState = {
  submitResult?: IEBaselineSubmitAttemptResponse;
};

export default function FinalResults() {
  const { moduleId, attemptId } = useParams<{ moduleId?: string; attemptId?: string }>();
  const numericModuleId = moduleId === undefined ? undefined : Number(moduleId);
  const numericAttemptId = attemptId === undefined ? undefined : Number(attemptId);
  const location = useLocation();
  const state = location.state as ResultsLocationState | null;
  const submittedAttempt = state?.submitResult?.attempt;
  const {
    ieBaselineUserId,
    isLoading: isResolvingCurrentUser,
    error: currentUserResolveError,
  } = useIEBaselineCurrentUser();

  const {
    data: homeData,
    isLoading: isLoadingHome,
    isError: isHomeError,
    error: homeError,
  } = useQuery({
    queryKey: ['iebaseline', 'home', ieBaselineUserId],
    queryFn: () => ieBaselineApi.home.get(ieBaselineUserId!),
    enabled: Boolean(ieBaselineUserId),
  });

  const shouldLoadModuleAttempts = numericAttemptId === undefined && Number.isFinite(numericModuleId);
  const {
    data: attemptHistory = [],
    isLoading: isLoadingAttempts,
    isError: isAttemptsError,
    error: attemptsError,
  } = useQuery({
    queryKey: ['iebaseline', 'modules', numericModuleId, 'attempts', ieBaselineUserId],
    queryFn: () => ieBaselineApi.modules.attempts.list(numericModuleId!, ieBaselineUserId!),
    enabled: shouldLoadModuleAttempts && Boolean(ieBaselineUserId),
    refetchOnWindowFocus: false,
  });

  const latestResultAttempt = useMemo(() => getLatestResultAttempt(attemptHistory), [attemptHistory]);
  const selectedAttemptId = numericAttemptId ?? submittedAttempt?.attemptId ?? latestResultAttempt?.attemptId;

  const {
    data: attemptQuestionsData,
    isLoading: isLoadingQuestions,
    isError: isQuestionsError,
    error: questionsError,
  } = useQuery({
    queryKey: ['iebaseline', 'attempts', selectedAttemptId, 'questions', ieBaselineUserId],
    queryFn: () => ieBaselineApi.attempts.questions.get(selectedAttemptId!, ieBaselineUserId!),
    enabled: Number.isFinite(selectedAttemptId) && Boolean(ieBaselineUserId),
    refetchOnWindowFocus: false,
  });

  const attempt = attemptQuestionsData?.attempt ?? latestResultAttempt ?? submittedAttempt;
  const questions = attemptQuestionsData?.questions ?? [];
  const assignment = homeData?.assignments.find((item) => item.module_id === attempt?.moduleId || String(item.module_id) === moduleId);
  const moduleName = getModuleName(attempt, assignment?.module_name, questions);
  const isInvalidRoute =
    (moduleId !== undefined && !Number.isFinite(numericModuleId)) ||
    (attemptId !== undefined && !Number.isFinite(numericAttemptId));
  const isLoading =
    isResolvingCurrentUser ||
    isLoadingHome ||
    (shouldLoadModuleAttempts && isLoadingAttempts && !submittedAttempt) ||
    (Boolean(selectedAttemptId) && isLoadingQuestions && questions.length === 0);
  const isError = Boolean(currentUserResolveError) || isHomeError || isAttemptsError || isQuestionsError || isInvalidRoute;
  const error = currentUserResolveError ?? homeError ?? attemptsError ?? questionsError;
  const resultStyle = getResultStyle(attempt?.resultStatus);
  const ResultIcon = resultStyle.Icon;
  const isWaitingForApproval = attempt?.resultStatus === 'PENDING' || attempt?.resultStatus === 'IN_PROGRESS';

  if (isLoading) {
    return (
      <ResultsShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Loading attempt results...</h1>
          <p className="text-sm text-muted-foreground">Fetching the selected attempt and saved answers.</p>
        </div>
      </ResultsShell>
    );
  }

  if (isError) {
    return (
      <ResultsShell>
        <Card className="mx-auto max-w-2xl border-destructive/30 bg-destructive/5 p-8 text-center">
          <XCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <h1 className="text-2xl font-bold text-foreground">Unable to Load Results</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isInvalidRoute
              ? 'The result URL contains an invalid module or attempt ID.'
              : error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.'}
          </p>
        </Card>
      </ResultsShell>
    );
  }

  if (!attempt) {
    return (
      <ResultsShell>
        <Card className="mx-auto max-w-2xl border-border/60 bg-background/70 p-8 text-center shadow-sm">
          <ClipboardCheck className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">No Result Attempt Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This module does not have a submitted checklist result available yet.
          </p>
        </Card>
      </ResultsShell>
    );
  }

  return (
    <ResultsShell>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className={cn('overflow-hidden border p-0 shadow-sm', resultStyle.panelClass)}>
          <div className="border-b border-white/40 bg-background/70 p-6 backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <Badge variant="outline" className={cn('w-fit border font-semibold', resultStyle.badgeClass)}>
                  {attempt.resultStatus}
                </Badge>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Attempt #{attempt.attemptNo} Results</p>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">{moduleName}</h1>
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
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <span className="text-6xl font-bold tracking-tight text-foreground">{formatScore(attempt.score)}</span>
                <span className="pb-2 text-sm font-medium text-muted-foreground">
                  {isWaitingForApproval ? 'Waiting for approval' : `${attempt.answeredQuestions} / ${attempt.totalQuestions} answered`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ResultMetric label="Result" value={attempt.resultStatus} />
              <ResultMetric label="Attempt" value={`#${attempt.attemptNo}`} />
              <ResultMetric label="Result Date" value={formatDateTime(getResultDate(attempt))} />
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
              <DetailRow label="Result Date" value={formatDateTime(getResultDate(attempt))} />
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

      <Card className="mx-auto mt-6 max-w-6xl overflow-hidden border-border/60 bg-background/70 shadow-sm">
        <div className="border-b border-border/60 bg-muted/40 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Question Results</h2>
        </div>
        {questions.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No saved answer detail is available for this attempt.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {questions.map((question) => (
              <QuestionResultRow key={question.id} question={question} />
            ))}
          </div>
        )}
      </Card>
    </ResultsShell>
  );
}

function ResultsShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-muted/20 px-6 py-8">
      <div className="mx-auto mb-6 max-w-6xl">
        <ContextBackButton />
      </div>
      {children}
      <div className="mx-auto mt-6 flex max-w-6xl justify-end">
        <ContextBackButton icon={<CalendarCheck className="h-4 w-4" />} label="Back" />
      </div>
    </div>
  );
}

function ContextBackButton({ icon = <ChevronLeft className="h-4 w-4" />, label = 'Back' }: { icon?: ReactNode; label?: string }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (location.key && location.key !== 'default') {
      navigate(-1);
      return;
    }

    navigate('/iebaseline');
  };

  return (
    <Button variant="ghost" size="sm" className="gap-2 -ml-3 text-muted-foreground hover:text-foreground" onClick={handleBack}>
      {icon}
      {label}
    </Button>
  );
}

function QuestionResultRow({ question }: { question: IEBaselineAttemptQuestion }) {
  const answer = question.answer;

  return (
    <div className="grid gap-4 px-4 py-4 text-sm lg:grid-cols-[minmax(0,1fr)_220px_160px]">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Question {question.questionNo ?? question.questionId}</p>
        <p className="mt-1 text-sm font-medium leading-6 text-foreground">{question.question}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">Selected Answer</p>
        <p className="mt-1 break-words font-medium text-foreground">{answer.selectedAnswer ?? 'Not answered'}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">Score</p>
        <p className="mt-1 font-medium text-foreground">{formatAnswerScore(answer.scoreAwarded, answer.maximumScore)}</p>
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

function getLatestResultAttempt(attempts: IEBaselineAttempt[]) {
  return attempts
    .filter(isResultAttempt)
    .sort((left, right) => getAttemptSortTime(right) - getAttemptSortTime(left))[0];
}

function getAttemptSortTime(attempt: IEBaselineAttempt) {
  const value = getResultDate(attempt) ?? attempt.startedAt;
  if (!value) return 0;

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getResultDate(attempt: IEBaselineAttempt) {
  return attempt.completedAt ?? attempt.submittedAt ?? attempt.lastSavedAt;
}

function isResultAttempt(attempt: IEBaselineAttempt) {
  if (attempt.submittedAt || attempt.completedAt) return true;
  if (attempt.attemptStatus === 'Submitted' || attempt.attemptStatus === 'Completed' || attempt.attemptStatus === 'Rejected') return true;

  return ['APPROVED', 'REJECTED', 'CANCELLED', 'Passed', 'Failed'].includes(attempt.resultStatus);
}

function getModuleName(attempt: IEBaselineAttempt | undefined, assignmentName: string | undefined, questions: IEBaselineAttemptQuestion[]) {
  return assignmentName ?? attempt?.moduleName ?? questions.find((question) => question.moduleName)?.moduleName ?? `Module ${attempt?.moduleId ?? 'N/A'}`;
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Pending';

  return `${Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`;
}

function formatAnswerScore(score: number | null | undefined, maximum: number | null | undefined) {
  if (score === null || score === undefined || maximum === null || maximum === undefined) return 'N/A';
  return `${Number(score).toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${Number(maximum).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
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

function getResultStyle(status: string | null | undefined) {
  switch (status) {
    case 'APPROVED':
    case 'Passed':
      return {
        Icon: CheckCircle2,
        panelClass: 'border-emerald-500/25 bg-emerald-500/5',
        badgeClass: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600',
        iconWrapClass: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600',
      };
    case 'REJECTED':
    case 'Failed':
      return {
        Icon: XCircle,
        panelClass: 'border-red-500/25 bg-red-500/5',
        badgeClass: 'border-red-500/25 bg-red-500/10 text-red-600',
        iconWrapClass: 'border-red-500/25 bg-red-500/10 text-red-600',
      };
    default:
      return {
        Icon: ClipboardCheck,
        panelClass: 'border-amber-500/25 bg-amber-500/5',
        badgeClass: 'border-amber-500/25 bg-amber-500/10 text-amber-600',
        iconWrapClass: 'border-amber-500/25 bg-amber-500/10 text-amber-600',
      };
  }
}
