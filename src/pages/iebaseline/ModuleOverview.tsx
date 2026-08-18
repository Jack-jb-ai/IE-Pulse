import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  Loader2,
  PlayCircle,
  RotateCcw,
  Trophy,
  UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ieBaselineApi, type IEBaselineAttemptHistoryItem, type IEBaselineHomeStatus } from './api';
import ExamModal from './components/ExamModal';
import { useIEBaselineCurrentUser } from './useIEBaselineCurrentUser';

type ActiveExam =
  | { mode: 'start' }
  | { mode: 'review' }
  | { mode: 'retake'; attemptId: number };

export default function ModuleOverview() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const [activeExam, setActiveExam] = useState<ActiveExam | null>(null);
  const {
    ieBaselineUserId,
    isLoading: isResolvingCurrentUser,
    error: currentUserResolveError,
  } = useIEBaselineCurrentUser();

  const {
    data,
    isLoading: isLoadingHome,
    isError: isHomeError,
    error: homeError,
  } = useQuery({
    queryKey: ['iebaseline', 'home', ieBaselineUserId],
    queryFn: () => ieBaselineApi.home.get(ieBaselineUserId!),
    enabled: Boolean(ieBaselineUserId),
  });

  const isLoading = isResolvingCurrentUser || isLoadingHome;
  const isError = Boolean(currentUserResolveError) || isHomeError;
  const error = currentUserResolveError ?? homeError;

  const assignment = data?.assignments.find((item) => String(item.module_id) === moduleId);

  const {
    data: attempts = [],
    isLoading: isLoadingAttempts,
    isError: isAttemptsError,
    error: attemptsError,
  } = useQuery({
    queryKey: ['iebaseline', 'attempts', 'list', ieBaselineUserId, assignment?.module_id],
    queryFn: () => ieBaselineApi.attempts.list(ieBaselineUserId!, assignment!.module_id),
    enabled: Boolean(ieBaselineUserId && assignment),
    refetchOnWindowFocus: false,
  });

  const sortedAttempts = useMemo(
    () => [...attempts].sort((left, right) => getAttemptSortTime(right) - getAttemptSortTime(left)),
    [attempts],
  );
  const latestRejectedAttempt = useMemo(() => getLatestRejectedAttempt(attempts), [attempts]);

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const getStatusColorClass = (status: IEBaselineHomeStatus) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20';
      case 'In Progress': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20';
      case 'Submitted': return 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/25';
      case 'Rejected': return 'bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/25';
      default: return 'bg-muted text-muted-foreground hover:bg-muted/80';
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name || name === 'N/A') return 'NA';

    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3 text-center">
        <BookOpen className="w-8 h-8 text-primary animate-pulse" />
        <h2 className="text-xl font-semibold text-foreground">Loading module overview...</h2>
        <p className="text-sm text-muted-foreground">Fetching the latest assigned module details.</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center px-6">
        <h2 className="text-2xl font-bold text-foreground">Unable to Load Module</h2>
        <p className="max-w-lg text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.'}
        </p>
        <Button asChild><Link to="/iebaseline">Return to Dashboard</Link></Button>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Module Not Found</h2>
        <Button asChild><Link to="/iebaseline">Return to Dashboard</Link></Button>
      </div>
    );
  }

  const isCompleted = assignment.status === 'Completed';
  const isSubmitted = assignment.status === 'Submitted';
  const isRejected = assignment.status === 'Rejected';
  const canStartOrContinue = assignment.status === 'Not Started' || assignment.status === 'In Progress' || assignment.status === 'Rejected';
  const primaryActionLabel = assignment.status === 'Not Started' ? 'Start Module' : 'Continue Module';
  const assigneeName = assignment.assigned_by?.name ?? 'N/A';
  const ownerName = assignment.owner_name ?? 'N/A';
  const openStartOrContinue = () => {
    if (assignment.status === 'Rejected' && !latestRejectedAttempt) {
      toast({
        title: 'Unable to continue module',
        description: attemptsError instanceof Error
          ? attemptsError.message
          : 'No rejected attempt was found for this module. Please refresh and try again.',
        variant: 'destructive',
      });
      return;
    }

    setActiveExam(assignment.status === 'Rejected'
      ? { mode: 'retake', attemptId: latestRejectedAttempt.attemptId }
      : { mode: 'start' });
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex items-center">
        <Button variant="ghost" size="sm" asChild className="gap-2 -ml-3 text-muted-foreground hover:text-foreground">
          <Link to="/iebaseline">
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {(isCompleted || isSubmitted || isRejected) && (
            <Card className={`${getStatusPanelClass(assignment.status)} overflow-hidden relative`}>
              <div className="absolute -right-6 -top-6 opacity-10 pointer-events-none">
                {isRejected ? <RotateCcw className="w-32 h-32" /> : <Trophy className="w-32 h-32" />}
              </div>
              <div className="p-6 flex items-center gap-6 relative z-10">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 border ${getStatusIconClass(assignment.status)}`}>
                  {isRejected ? <RotateCcw className="w-8 h-8" /> : isSubmitted ? <Clock className="w-8 h-8" /> : <Trophy className="w-8 h-8" />}
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-foreground">{getStatusTitle(assignment.status)}</h3>
                  <p className="text-sm text-muted-foreground">{getStatusDescription(assignment.status)}</p>
                </div>
              </div>
            </Card>
          )}

          <div className="space-y-4">
            <Badge variant="outline" className={`${getStatusColorClass(assignment.status)} font-semibold border`}>
              {assignment.status}
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{assignment.module_name}</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {assignment.description ?? 'No description available for this module yet.'}
            </p>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/50 border border-border/50">
              <TabsTrigger value="overview">Module Overview</TabsTrigger>
              <TabsTrigger value="details">Additional Details</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-6">
              <div className="space-y-3">
                <div className="group flex items-center justify-between p-4 rounded-xl bg-background/50 border border-border/50 hover:border-primary/30 hover:shadow-sm transition-all duration-200">
                  <div className="flex items-center gap-4">
                    {isCompleted ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border shrink-0">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium text-foreground">Baseline checklist</h4>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <FileText className="w-3.5 h-3.5" />
                        {assignment.question_count} question{assignment.question_count === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  {canStartOrContinue && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:bg-primary/10 hover:text-primary"
                      disabled={assignment.status === 'Rejected' && isLoadingAttempts}
                      onClick={openStartOrContinue}
                    >
                      <PlayCircle className="w-6 h-6" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      <Calendar className="w-3.5 h-3.5" />
                      Assigned
                    </span>
                    <p className="text-sm font-medium text-foreground">{formatDate(assignment.assigned_at)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      <Clock className="w-3.5 h-3.5" />
                      Last Updated
                    </span>
                    <p className="text-sm font-medium text-foreground">{formatDate(assignment.updated_at)}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="details" className="pt-6">
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      <BookOpen className="w-3.5 h-3.5" />
                      Module ID
                    </span>
                    <p className="text-sm font-medium text-foreground">{assignment.module_id}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Checklist Status
                    </span>
                    <Badge variant="outline" className={`${getStatusColorClass(assignment.status)} font-semibold border`}>
                      {assignment.status}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    <UserCircle className="w-3.5 h-3.5" />
                    Assignment Owner
                  </span>
                  <p className="text-sm font-medium text-foreground">{ownerName}</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            <Card className="overflow-hidden border-border/50 bg-background/60 backdrop-blur-md shadow-lg shadow-black/5">
              <div className="h-32 w-full bg-gradient-to-br from-primary/20 via-blue-500/10 to-emerald-500/20 relative overflow-hidden flex items-center justify-center border-b border-border/50">
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]"></div>
                <BookOpen className="w-12 h-12 text-primary/40 relative z-10 drop-shadow-sm" />
              </div>

              <div className="p-6 space-y-6">
                {isCompleted ? (
                  <div className="grid gap-3">
                    <Button
                      variant="outline"
                      className="w-full h-12 text-md font-semibold gap-2"
                      size="lg"
                      asChild
                    >
                      <Link to={`/iebaseline/module/${assignment.module_id}/results`}>
                        View Result
                        <Eye className="w-5 h-5" />
                      </Link>
                    </Button>
                  </div>
                ) : isSubmitted ? (
                  <div className="grid gap-3">
                    <Button
                      variant="outline"
                      className="w-full h-12 text-md font-semibold gap-2"
                      size="lg"
                      asChild
                    >
                      <Link to={`/iebaseline/module/${assignment.module_id}/results`}>
                        View Module / Result
                        <Eye className="w-5 h-5" />
                      </Link>
                    </Button>
                  </div>
                ) : isRejected ? (
                  <div className="grid gap-3">
                    <Button className="w-full h-12 text-md font-semibold gap-2 shadow-sm" size="lg" disabled={isLoadingAttempts} onClick={openStartOrContinue}>
                      {isLoadingAttempts ? 'Loading Attempt...' : 'Continue Module'}
                      {isLoadingAttempts ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
                    </Button>
                  </div>
                ) : (
                  <Button className="w-full h-12 text-md font-semibold gap-2 shadow-sm" size="lg" onClick={openStartOrContinue}>
                    {primaryActionLabel}
                    <PlayCircle className="w-5 h-5" />
                  </Button>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="w-4 h-4" /> Progress</span>
                    <span className="font-medium text-foreground">{assignment.progress}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground"><FileText className="w-4 h-4" /> Questions</span>
                    <span className="font-medium text-foreground">{assignment.question_count}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4" /> Delivery</span>
                    <span className="font-medium text-foreground">Self-Directed</span>
                  </div>
                </div>

                <hr className="border-border/50" />

                <div className="space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assigned By</span>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border/50">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-primary/10 text-primary">{getInitials(assigneeName)}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">{assigneeName}</p>
                      <p className="text-xs text-muted-foreground">Module assignee</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <ModulePreviousAttempts
        attempts={sortedAttempts}
        isLoading={isLoadingAttempts}
        isError={isAttemptsError}
        error={attemptsError}
      />

      {activeExam && (
        <ExamModal
          moduleId={assignment.module_id}
          moduleName={assignment.module_name}
          userId={ieBaselineUserId!}
          reviewOnly={activeExam.mode === 'review'}
          initialAttemptId={activeExam.mode === 'retake' ? activeExam.attemptId : undefined}
          onClose={() => setActiveExam(null)}
        />
      )}
    </div>
  );
}

function ModulePreviousAttempts({
  attempts,
  isLoading,
  isError,
  error,
}: {
  attempts: IEBaselineAttemptHistoryItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
          <ClipboardList className="h-5 w-5 text-primary" />
          Previous Attempts
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Review submitted, approved, and rejected attempts for this module.</p>
      </div>

      <Card className="overflow-hidden border-border/60 bg-background/70 shadow-sm">
        {isLoading ? (
          <div className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading previous attempts...
          </div>
        ) : isError ? (
          <div className="border-destructive/20 bg-destructive/5 p-6">
            <h3 className="text-sm font-semibold text-foreground">Unable to Load Previous Attempts</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-12 gap-4 border-b border-border/60 bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
                <div className="col-span-4">Module</div>
                <div className="col-span-2">Attempt</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Score</div>
                <div className="col-span-1">Result Date</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              {attempts.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">No previous attempts are available for this module yet.</div>
              )}

              {attempts.map((attempt) => (
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
                  <div className="col-span-2 font-medium text-foreground">{formatAttemptScore(attempt.score)}</div>
                  <div className="col-span-1 text-xs text-muted-foreground">{formatAttemptDate(getResultDate(attempt))}</div>
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
            </div>
          </div>
        )}
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

export function getLatestRejectedAttempt(attempts: IEBaselineAttemptHistoryItem[]) {
  return attempts
    .filter((attempt) => attempt.attemptStatus === 'Rejected' || attempt.resultStatus === 'REJECTED')
    .sort((left, right) => getAttemptSortTime(right) - getAttemptSortTime(left))[0];
}

function getResultDate(attempt: IEBaselineAttemptHistoryItem) {
  return attempt.completedAt ?? attempt.submittedAt ?? attempt.lastSavedAt;
}

function formatAttemptScore(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Pending';
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function formatAttemptDate(value: string | null | undefined) {
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

function getStatusPanelClass(status: IEBaselineHomeStatus) {
  switch (status) {
    case 'Completed':
      return 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-background border-emerald-500/30';
    case 'Submitted':
      return 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-background border-amber-500/30';
    case 'Rejected':
      return 'bg-gradient-to-r from-red-500/10 via-red-500/5 to-background border-red-500/30';
    default:
      return 'bg-background/60 border-border/50';
  }
}

function getStatusIconClass(status: IEBaselineHomeStatus) {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-500/20 border-emerald-500/30 text-emerald-500';
    case 'Submitted':
      return 'bg-amber-500/20 border-amber-500/30 text-amber-600';
    case 'Rejected':
      return 'bg-red-500/20 border-red-500/30 text-red-600';
    default:
      return 'bg-muted border-border text-muted-foreground';
  }
}

function getStatusTitle(status: IEBaselineHomeStatus) {
  switch (status) {
    case 'Completed':
      return 'Module Completed';
    case 'Submitted':
      return 'Submission Pending Review';
    case 'Rejected':
      return 'Submission Rejected';
    default:
      return 'Module Assigned';
  }
}

function getStatusDescription(status: IEBaselineHomeStatus) {
  switch (status) {
    case 'Completed':
      return 'This assigned checklist is marked as completed.';
    case 'Submitted':
      return 'Your checklist has been submitted and is waiting for approval.';
    case 'Rejected':
      return 'Your previous submission was rejected. Continue the module when ready.';
    default:
      return 'This checklist is available to start or continue.';
  }
}
