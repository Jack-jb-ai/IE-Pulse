import { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Download, Eraser, FileText, Loader2, Paperclip, Save, Trash2, Trophy, Upload, X, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  IEBaselineApiError,
  ieBaselineApi,
  type IEBaselineAttachment,
  type IEBaselineApprovalDecision,
  type IEBaselineAttempt,
  type IEBaselineAttemptAnswer,
  type IEBaselineAttemptQuestion,
  type IEBaselineAttemptProgress,
  type IEBaselineValidationDetail,
} from '../api';

interface ExamModalProps {
  moduleId: number;
  moduleName: string;
  userId: number;
  onClose: () => void;
  reviewOnly?: boolean;
  approvalId?: number;
}

export default function ExamModal({ moduleId, moduleName, userId, onClose, reviewOnly = false, approvalId }: ExamModalProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isApprovalReview = approvalId !== undefined;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [progress, setProgress] = useState<IEBaselineAttemptProgress | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaveRequest, setLastSaveRequest] = useState<{ questionId: number; selectedAnswer: string | null } | null>(null);
  const [savedState, setSavedState] = useState<{ attemptId: number; lastSavedAt: string } | null>(null);
  const [submitValidation, setSubmitValidation] = useState<IEBaselineValidationDetail | null>(null);
  const [remarks, setRemarks] = useState('');
  const initializedAttemptId = useRef<number | null>(null);
  const startedApprovalId = useRef<number | null>(null);

  const {
    data: startData,
    isLoading: isStarting,
    isError: isStartError,
    error: startError,
  } = useQuery({
    queryKey: ['iebaseline', 'modules', moduleId, 'attempts', 'active', userId],
    queryFn: () => ieBaselineApi.modules.attempts.start(moduleId, userId),
    enabled: !reviewOnly && !isApprovalReview,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const {
    data: attemptHistory = [],
    isLoading: isLoadingHistory,
    isError: isHistoryError,
    error: historyError,
  } = useQuery({
    queryKey: ['iebaseline', 'modules', moduleId, 'attempts', userId],
    queryFn: () => ieBaselineApi.modules.attempts.list(moduleId, userId),
    enabled: reviewOnly && !isApprovalReview,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const reviewAttempt = useMemo(() => getLatestReviewAttempt(attemptHistory), [attemptHistory]);
  const {
    data: approvalReviewData,
    isLoading: isLoadingApprovalReview,
    isError: isApprovalReviewError,
    error: approvalReviewError,
  } = useQuery({
    queryKey: ['iebaseline', 'approvals', approvalId, 'review', userId],
    queryFn: () => ieBaselineApi.approvals.getReview(approvalId!, userId),
    enabled: isApprovalReview,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const activeAttempt = isApprovalReview ? approvalReviewData?.attempt : reviewOnly ? reviewAttempt : startData?.attempt;
  const attemptId = activeAttempt?.attemptId;
  const approval = approvalReviewData?.approval;
  const isTerminalApproval = approval?.status === 'APPROVED' || approval?.status === 'REJECTED' || approval?.status === 'CANCELLED';

  const {
    data: attemptQuestionsData,
    isLoading: isLoadingQuestions,
    isError: isQuestionsError,
    error: questionsError,
  } = useQuery({
    queryKey: ['iebaseline', 'attempts', attemptId, 'questions', userId],
    queryFn: () => ieBaselineApi.attempts.questions.get(attemptId!, userId),
    enabled: Boolean(attemptId) && !isApprovalReview,
    refetchOnWindowFocus: false,
  });

  const startApprovalMutation = useMutation({
    mutationFn: () => {
      if (!approvalId) throw new Error('Approval is not ready yet.');
      return ieBaselineApi.approvals.start(approvalId, userId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'approvals', approvalId, 'review', userId] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'approvals', 'inbox', userId] }),
      ]);
    },
  });

  const saveAnswerMutation = useMutation({
    mutationFn: ({ questionId, selectedAnswer }: { questionId: number; selectedAnswer: string | null }) => {
      if (!attemptId) throw new Error('Attempt is not ready yet.');
      if (isApprovalReview) {
        if (!approvalId) throw new Error('Approval is not ready yet.');
        if (isTerminalApproval) throw new Error('Completed approvals are read-only.');
        const answerId = question?.answer.answerId;
        if (!answerId) throw new Error('This question is missing its backend answer shell.');
        return ieBaselineApi.approvals.updateAnswer(approvalId, answerId, userId, selectedAnswer);
      }
      if (reviewOnly) throw new Error('Completed attempts are read-only.');

      if (selectedAnswer === null) {
        return ieBaselineApi.attempts.questions.clearAnswer(attemptId, questionId, userId);
      }

      return ieBaselineApi.attempts.questions.saveAnswer(attemptId, questionId, { selectedAnswer }, userId);
    },
    onMutate: (variables) => {
      setLastSaveRequest(variables);
    },
    onSuccess: (data) => {
      setSaveError(null);
      setLastSaveRequest(null);
      if (attemptId) {
        setSavedState({ attemptId, lastSavedAt: data.lastSavedAt });
      }
      setProgress({
        answeredQuestions: data.answeredQuestions,
        totalQuestions: data.totalQuestions,
        progressPercentage: data.progressPercentage,
        lastSavedAt: data.lastSavedAt,
      });
      const queryKey = isApprovalReview
        ? ['iebaseline', 'approvals', approvalId, 'review', userId]
        : ['iebaseline', 'attempts', attemptId, 'questions', userId];
      queryClient.setQueryData(queryKey, (current: typeof attemptQuestionsData | typeof approvalReviewData | undefined) => {
        if (!current) return current;

        return {
          ...current,
          progress: {
            answeredQuestions: data.answeredQuestions,
            totalQuestions: data.totalQuestions,
            progressPercentage: data.progressPercentage,
            lastSavedAt: data.lastSavedAt,
          },
          questions: current.questions.map((item) => item.questionId === data.questionId
            ? {
                ...item,
                answer: {
                  ...item.answer,
                  answerId: data.answerId,
                  selectedAnswer: data.selectedAnswer,
                  isAnswered: data.isAnswered,
                  isAttached: data.isAttached,
                  lastSavedAt: data.lastSavedAt,
                },
              }
            : item),
        };
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.';
      setSaveError(message);
    },
  });

  const submitAttemptMutation = useMutation({
    mutationFn: async () => {
      if (!attemptId) throw new Error('Attempt is not ready yet.');
      return ieBaselineApi.attempts.submit(attemptId, userId);
    },
    onSuccess: async (data) => {
      setProgress(data.progress);
      const scoreText = formatScore(data.attempt.score);
      const waitingForApproval = data.attempt.resultStatus === 'PENDING' || data.attempt.resultStatus === 'IN_PROGRESS';
      toast({
        title: waitingForApproval ? 'Checklist submitted' : 'Checklist scored',
        description: waitingForApproval
          ? 'Your answers were submitted and are waiting for approval.'
          : scoreText
            ? `Your answers were scored. Score: ${scoreText}.`
            : 'Your answers were submitted and scored.',
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'home', userId] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'modules', moduleId, 'attempts', 'active', userId], refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'modules', moduleId, 'attempts', userId] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'attempts', 'list', userId] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'attempts', attemptId] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'attempts', attemptId, 'questions', userId] }),
      ]);

      onClose();
      navigate(`/iebaseline/attempts/${data.attempt.attemptId}/results`, {
        state: { submitResult: data },
      });
    },
    onError: (error) => {
      if (error instanceof IEBaselineApiError && error.validationDetail) {
        setSubmitValidation(error.validationDetail);
        return;
      }

      toast({
        title: 'Unable to submit checklist',
        description: error instanceof Error ? error.message : 'Please make sure every required question is answered.',
        variant: 'destructive',
      });
    },
  });

  const decisionMutation = useMutation({
    mutationFn: (decision: IEBaselineApprovalDecision) => {
      if (!approvalId) throw new Error('Approval is not ready yet.');
      return ieBaselineApi.approvals.decision(approvalId, userId, decision, remarks.trim() || undefined);
    },
    onSuccess: async (data) => {
      setProgress(data.progress);
      toast({
        title: data.approval.status === 'APPROVED' ? 'Approval completed' : 'Submission rejected',
        description: `Final status: ${data.attempt.resultStatus}. Score: ${formatScore(data.attempt.score) ?? 'Pending'}.`,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'approvals'] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'home'] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'modules', data.attempt.moduleId, 'attempts'] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'attempts'] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'attempts', data.attempt.attemptId] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'attempts', data.attempt.attemptId, 'questions', userId] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'approvals', approvalId, 'review', userId] }),
      ]);
    },
    onError: (error) => {
      toast({
        title: 'Unable to complete approval',
        description: error instanceof Error ? error.message : 'Please check the approval status and try again.',
        variant: 'destructive',
      });
    },
  });

  const questionsData = isApprovalReview ? approvalReviewData : attemptQuestionsData;
  const questions = questionsData?.questions ?? [];
  const attempt = questionsData?.attempt ?? activeAttempt;
  const question = questions[currentIndex];
  const effectiveModuleId = question?.moduleId ?? attempt?.moduleId ?? moduleId;
  const options = useMemo(() => parseOptions(question?.options), [question?.options]);
  const selectedOption = question ? answers[question.questionId] ?? '' : '';
  const answeredCount = questions.filter((item) => Boolean(answers[item.questionId])).length;
  const totalQuestions = progress?.totalQuestions ?? questions.length;
  const progressPct = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
  const canEditAnswers = isApprovalReview
    ? !isTerminalApproval
    : !reviewOnly && isAttemptEditable(attempt);
  const isReviewMode = !canEditAnswers;
  const isLoading = isApprovalReview ? isLoadingApprovalReview : (reviewOnly ? isLoadingHistory : isStarting) || isLoadingQuestions;
  const isError = isApprovalReview ? isApprovalReviewError : (reviewOnly ? isHistoryError : isStartError) || isQuestionsError;
  const error = isApprovalReview ? approvalReviewError : (reviewOnly ? historyError : startError) ?? questionsError;
  const isBusy = saveAnswerMutation.isPending || submitAttemptMutation.isPending || decisionMutation.isPending || startApprovalMutation.isPending;
  const isMissingAnswerShell = Boolean(question && canEditAnswers && question.answer.answerId === null);
  const hasAttachmentSection = question?.attachmentRequirement === 'required' || question?.attachmentRequirement === 'optional';
  const currentAnswerId = question?.answer.answerId ?? null;
  const canSubmit = totalQuestions > 0 && answeredCount >= totalQuestions;
  const requiresAnswerToContinue = canEditAnswers && !isApprovalReview && options.length > 0;

  const {
    data: attachmentData,
    isLoading: isLoadingAttachments,
    isError: isAttachmentsError,
    error: attachmentsError,
  } = useQuery({
    queryKey: ['iebaseline', 'modules', effectiveModuleId, 'attachments', currentAnswerId, userId],
    queryFn: () => ieBaselineApi.modules.attachments.list(effectiveModuleId, currentAnswerId!, userId),
    enabled: Boolean(hasAttachmentSection && currentAnswerId),
    refetchOnWindowFocus: false,
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: ({ answerId, file }: { answerId: number; file: File }) =>
      ieBaselineApi.modules.attachments.upload(effectiveModuleId, answerId, file, userId),
    onSuccess: async () => {
      toast({
        title: 'Attachment uploaded',
        description: 'The evidence file was linked to this answer.',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'modules', effectiveModuleId, 'attachments', currentAnswerId, userId] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'attempts', attemptId, 'questions', userId] }),
      ]);
    },
    onError: (error) => {
      toast({
        title: 'Attachment upload failed',
        description: error instanceof Error ? error.message : 'Please try another file or contact support.',
        variant: 'destructive',
      });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentUnqId: string) =>
      ieBaselineApi.modules.attachments.remove(effectiveModuleId, attachmentUnqId, userId),
    onSuccess: async () => {
      toast({
        title: 'Attachment removed',
        description: 'The evidence file was removed from this answer.',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'modules', effectiveModuleId, 'attachments', currentAnswerId, userId] }),
        queryClient.invalidateQueries({ queryKey: ['iebaseline', 'attempts', attemptId, 'questions', userId] }),
      ]);
    },
    onError: (error) => {
      toast({
        title: 'Unable to remove attachment',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const isAttachmentBusy = uploadAttachmentMutation.isPending || deleteAttachmentMutation.isPending;

  useEffect(() => {
    if (!questionsData || initializedAttemptId.current === questionsData.attempt.attemptId) return;

    const savedAnswers = questionsData.questions.reduce<Record<number, string>>((current, item) => {
      if (item.answer.isAnswered && item.answer.selectedAnswer) {
        current[item.questionId] = item.answer.selectedAnswer;
      }
      return current;
    }, {});

    const firstUnansweredIndex = questionsData.questions.findIndex((item) => !item.answer.isAnswered);
    const hasSavedAnswer = questionsData.questions.some((item) => item.answer.isAnswered && item.answer.lastSavedAt);

    setAnswers(savedAnswers);
    setProgress(questionsData.progress);
    setSaveError(null);
    setLastSaveRequest(null);
    setRemarks(isApprovalReview ? questionsData.approval.remarks ?? '' : '');
    setSavedState(
      questionsData.progress.lastSavedAt && hasSavedAnswer
        ? {
            attemptId: questionsData.attempt.attemptId,
            lastSavedAt: questionsData.progress.lastSavedAt,
          }
        : null,
    );
    setCurrentIndex(firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0);
    initializedAttemptId.current = questionsData.attempt.attemptId;
  }, [questionsData, isApprovalReview]);

  useEffect(() => {
    if (!isApprovalReview || !approvalId || approval?.status !== 'PENDING') return;
    if (startedApprovalId.current === approvalId) return;
    startedApprovalId.current = approvalId;
    startApprovalMutation.mutate();
  }, [approval?.status, approvalId, isApprovalReview]);

  const setSelectedOption = (value: string) => {
    if (!question || !canEditAnswers || isMissingAnswerShell) return;
    setAnswers((current) => ({
      ...current,
      [question.questionId]: value,
    }));
    setSaveError(null);
    setLastSaveRequest(null);
    setSavedState(null);
  };

  const clearSelectedOption = () => {
    if (!question || !selectedOption || !canEditAnswers || isMissingAnswerShell) return;

    setAnswers((current) => {
      const next = { ...current };
      delete next[question.questionId];
      return next;
    });
    setSaveError(null);
    setLastSaveRequest(null);
    setSavedState(null);
  };

  const persistCurrentAnswer = async () => {
    if (!question || !attemptId || !canEditAnswers) return;
    if (question.answer.answerId === null) {
      setSaveError('This question is missing its backend answer shell. Please close and reopen the checklist, then try again.');
      throw new Error('Answer shell is missing.');
    }
    const answer = answers[question.questionId];
    if (!answer) return;

    await saveAnswerMutation.mutateAsync({ questionId: question.questionId, selectedAnswer: answer });
  };

  const goPrevious = () => {
    setCurrentIndex((value) => Math.max(0, value - 1));
  };

  const goNext = async () => {
    try {
      await persistCurrentAnswer();
    } catch {
      return;
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((value) => value + 1);
      return;
    }

    if (isReviewMode || isApprovalReview) return;
    submitAttemptMutation.mutate();
  };

  const uploadAttachment = (file: File | undefined) => {
    if (!file || !currentAnswerId) return;
    uploadAttachmentMutation.mutate({ answerId: currentAnswerId, file });
  };

  const removeAttachment = (attachment: IEBaselineAttachment) => {
    const confirmed = window.confirm(`Remove attachment "${attachment.originalFileName}"?`);
    if (!confirmed) return;
    deleteAttachmentMutation.mutate(attachment.attachmentUnqId);
  };

  const goToValidationQuestion = (questionId: number) => {
    const index = questions.findIndex((item) => item.questionId === questionId);
    if (index >= 0) {
      setCurrentIndex(index);
      setSubmitValidation(null);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const renderSaveState = () => {
    if (saveAnswerMutation.isPending) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Saving
        </span>
      );
    }

    if (saveError) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="w-3.5 h-3.5" />
          Save failed
        </span>
      );
    }

    if (attemptId && savedState?.attemptId === attemptId && savedState.lastSavedAt) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <Save className="w-3.5 h-3.5" />
          Saved
        </span>
      );
    }

    return null;
  };

  const modalContent = (
    <>
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-md animate-in fade-in duration-300 overflow-hidden">
      <div className="relative flex-shrink-0 flex flex-col items-center pt-4 pb-3 px-6 gap-2">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-white/50 text-sm font-semibold uppercase tracking-widest">
            {moduleName}
          </span>
          {questions.length > 0 && (
            <span className="text-white/70 text-sm font-bold tabular-nums">
              Question {currentIndex + 1} / {questions.length}
            </span>
          )}
        </div>

        <div className="w-full max-w-2xl h-4 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="absolute top-3 right-4 lg:right-6 z-[110]">
        <Button variant="ghost" size="icon" onClick={handleClose} disabled={isBusy} className="text-white/70 hover:text-white hover:bg-white/20 rounded-full">
          <X className="w-6 h-6" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-scroll">
        <div className="w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-2 px-6 pb-6 lg:px-12 lg:pb-10 gap-8 lg:gap-16">
          <div className="flex min-h-0 flex-col pr-2 lg:pr-4">
            <div className="space-y-6 lg:space-y-8 animate-in slide-in-from-left-4 duration-500 py-6">
              {isLoading && (
                <div className="flex items-center gap-3 text-white/80">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <h2 className="text-3xl md:text-4xl font-bold">Loading checklist questions...</h2>
                </div>
              )}

              {isError && (
                <div className="space-y-4 text-white">
                  <AlertCircle className="w-10 h-10 text-red-400" />
                  <h2 className="text-3xl md:text-4xl font-bold">Unable to Load Questions</h2>
                  <p className="text-white/70 text-lg">
                    {error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.'}
                  </p>
                </div>
              )}

              {!isLoading && !isError && questions.length === 0 && (
                <div className="space-y-4 text-white">
                  <FileText className="w-10 h-10 text-white/60" />
                  <h2 className="text-3xl md:text-4xl font-bold">{reviewOnly ? 'No Completed Attempt' : 'No Checklist Questions'}</h2>
                  <p className="text-white/70 text-lg">
                    {reviewOnly
                      ? 'There is no scored attempt available to review yet.'
                      : 'This module exists, but no checklist rows are available yet.'}
                  </p>
                </div>
              )}

              {question && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {question.category && <Badge variant="secondary">{question.category}</Badge>}
                    {question.risk && <Badge variant="outline" className="border-white/20 text-white/70">{question.risk}</Badge>}
                    {question.questionNo !== null && question.questionNo !== undefined && (
                      <Badge variant="outline" className="border-white/20 text-white/70">#{question.questionNo}</Badge>
                    )}
                  </div>
                  <h2 className="whitespace-pre-line text-[clamp(1.5rem,2.4vw,2.5rem)] font-bold text-white leading-snug">
                    {question.question}
                  </h2>
                  <QuestionContext question={question} />
                </>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col py-6 lg:px-4">
            <Card className="bg-background/95 backdrop-blur-md border-border/50 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] p-2 sm:p-4 animate-in slide-in-from-right-8 duration-500 relative overflow-hidden rounded-2xl w-full h-fit">
              <div className="space-y-4 p-4 sm:p-5">
                {question && (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{isApprovalReview ? 'Approver Response' : isReviewMode ? 'Review Response' : 'Select Response'}</h3>
                          <p className="text-sm text-muted-foreground">
                            {answeredCount} of {totalQuestions} answered
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {canEditAnswers && renderSaveState()}
                          {selectedOption && <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />}
                        </div>
                      </div>

                      {isReviewMode && attempt && (
                        <ScoreSummary attempt={attempt} />
                      )}

                      {isApprovalReview && approval && (
                        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="font-medium text-muted-foreground">Approval status</span>
                            <Badge variant="outline" className={getApprovalStatusClass(approval.status)}>{approval.status}</Badge>
                          </div>
                        </div>
                      )}

                      {canEditAnswers && saveError && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                          <span>{saveError}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                            disabled={!lastSaveRequest || isBusy}
                            onClick={() => {
                              if (lastSaveRequest) saveAnswerMutation.mutate(lastSaveRequest);
                            }}
                          >
                            Retry
                          </Button>
                        </div>
                      )}

                      {isMissingAnswerShell && (
                        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                          This question is missing its backend answer shell. Close and reopen the checklist; if it remains, the attempt needs backend shell backfill.
                        </div>
                      )}

                      {options.length > 0 ? (
                        <RadioGroup value={selectedOption} onValueChange={setSelectedOption} disabled={!canEditAnswers || isMissingAnswerShell || isBusy} className="grid gap-2">
                          {options.map((option) => (
                            <label
                              key={option.id}
                              className={cn(
                                'flex items-center space-x-3 p-3 sm:p-4 rounded-xl border-2 transition-all select-none group',
                                !canEditAnswers ? 'cursor-default' : 'cursor-pointer',
                                selectedOption === option.value
                                  ? 'border-primary bg-primary/5'
                                  : cn('border-border bg-background/50', canEditAnswers && 'hover:border-primary/50 hover:bg-muted/50'),
                              )}
                            >
                              <RadioGroupItem value={option.value} id={option.id} className="mt-0.5 data-[state=checked]:border-primary" />
                              <span className="flex-1 text-sm sm:text-base font-medium leading-snug text-foreground/80 group-hover:text-foreground">
                                {option.label}
                              </span>
                            </label>
                          ))}
                        </RadioGroup>
                      ) : (
                        <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                          This question has no stored response options yet.
                        </div>
                      )}

                      {isReviewMode && question.answer.isAnswered && (
                        <AnswerScore answer={question.answer} />
                      )}

                      {hasAttachmentSection && (
                        <AttachmentSection
                          attachments={attachmentData?.attachments ?? []}
                          userId={userId}
                          requirement={question.attachmentRequirement}
                          instruction={question.attachmentInstruction}
                          canEdit={!isApprovalReview && canEditAnswers && !isMissingAnswerShell}
                          answerId={currentAnswerId}
                          isLoading={isLoadingAttachments}
                          isError={isAttachmentsError}
                          error={attachmentsError}
                          isBusy={isAttachmentBusy}
                          onUpload={uploadAttachment}
                          onRemove={removeAttachment}
                        />
                      )}
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row justify-between gap-3">
                      <Button variant="outline" size="lg" className="gap-2" disabled={currentIndex === 0 || isBusy} onClick={goPrevious}>
                        <ArrowLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <div className="flex flex-col sm:flex-row gap-3">
                        {canEditAnswers && !isApprovalReview && (
                          <Button variant="outline" size="lg" className="gap-2" disabled={!selectedOption || isBusy || isMissingAnswerShell} onClick={clearSelectedOption}>
                            <Eraser className="w-4 h-4" />
                            Clear
                          </Button>
                        )}
                        <Button
                          size="lg"
                          className="gap-2"
                          disabled={(requiresAnswerToContinue && !selectedOption) || isBusy || isMissingAnswerShell || (currentIndex === questions.length - 1 && !isReviewMode && !isApprovalReview && !canSubmit)}
                          onClick={currentIndex === questions.length - 1 && isReviewMode ? onClose : goNext}
                        >
                          {submitAttemptMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                          {currentIndex < questions.length - 1 ? 'Next Question' : isReviewMode ? 'Close Review' : isApprovalReview ? 'Save Response' : 'Finish Checklist'}
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {isApprovalReview && (
                      <div className="mt-5 space-y-4 border-t border-border pt-5">
                        <Textarea
                          value={remarks}
                          onChange={(event) => setRemarks(event.target.value)}
                          disabled={isTerminalApproval || isBusy}
                          placeholder="Reviewer remarks"
                          className="min-h-[110px]"
                        />
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={isTerminalApproval || isBusy}
                            onClick={() => decisionMutation.mutate('REJECTED')}
                          >
                            {decisionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                            Reject
                          </Button>
                          <Button
                            type="button"
                            className="gap-2"
                            disabled={isTerminalApproval || isBusy}
                            onClick={() => decisionMutation.mutate('APPROVED')}
                          >
                            {decisionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Approve
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!question && (
                  <div className="flex justify-end">
                    <Button size="lg" onClick={handleClose}>Close</Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
    <SubmitValidationDialog
      validation={submitValidation}
      questions={questions}
      onOpenChange={(open) => {
        if (!open) setSubmitValidation(null);
      }}
      onGoToQuestion={goToValidationQuestion}
    />
    </>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}

function parseOptions(value?: string | null) {
  if (!value) return [];

  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((label, index) => ({
      id: `option-${index}`,
      label,
      value: label,
    }));
}

function getLatestReviewAttempt(attempts: IEBaselineAttempt[]) {
  return attempts
    .filter(isReviewableAttempt)
    .sort((left, right) => getAttemptSortTime(right) - getAttemptSortTime(left))[0];
}

function isAttemptEditable(attempt: IEBaselineAttempt | undefined) {
  if (!attempt) return true;
  if (attempt.submittedAt || attempt.completedAt) return false;

  return attempt.attemptStatus !== 'Submitted' && attempt.attemptStatus !== 'Completed';
}

function isReviewableAttempt(attempt: IEBaselineAttempt) {
  if (attempt.submittedAt || attempt.completedAt) return true;
  if (attempt.attemptStatus === 'Submitted' || attempt.attemptStatus === 'Completed' || attempt.attemptStatus === 'Rejected') return true;

  return ['APPROVED', 'REJECTED', 'CANCELLED', 'Passed', 'Failed'].includes(attempt.resultStatus);
}

function getAttemptSortTime(attempt: IEBaselineAttempt) {
  const value = attempt.completedAt ?? attempt.submittedAt ?? attempt.lastSavedAt ?? attempt.startedAt;
  if (!value) return 0;

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return null;

  return `${Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`;
}

function formatPoints(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Pending';

  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function getApprovalStatusClass(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600';
    case 'REJECTED':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    case 'IN_PROGRESS':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-600';
    case 'CANCELLED':
      return 'border-muted-foreground/30 bg-muted text-muted-foreground';
    default:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-600';
  }
}

function ScoreSummary({ attempt }: { attempt: IEBaselineAttempt }) {
  const scoreText = formatScore(attempt.score);
  const statusText = getAttemptDisplayStatus(attempt);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
      <div className="sm:col-span-1 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score</span>
          <span className="text-lg font-bold text-foreground">{scoreText ?? 'Pending'}</span>
        </div>
      </div>
      <div>
        <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Correct</span>
        <span className="text-sm font-semibold text-foreground">{attempt.correctAnswers} of {attempt.totalQuestions}</span>
      </div>
      <div>
        <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
        <span className="text-sm font-semibold text-foreground">{statusText}</span>
      </div>
    </div>
  );
}

function getAttemptDisplayStatus(attempt: IEBaselineAttempt) {
  if (attempt.resultStatus === 'REJECTED') return 'Rejected';
  if (attempt.resultStatus === 'APPROVED') return 'Approved';
  if ((attempt.resultStatus === 'PENDING' || attempt.resultStatus === 'IN_PROGRESS') && attempt.submittedAt) return 'Submitted';
  return attempt.attemptStatus;
}

function AnswerScore({ answer }: { answer: IEBaselineAttemptAnswer }) {
  const isExcluded = answer.isAnswered && answer.scoreAwarded === null && answer.maximumScore === null;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-muted-foreground">Awarded points</span>
        <span className="font-semibold text-foreground">
          {isExcluded ? 'Excluded' : `${formatPoints(answer.scoreAwarded)} / ${formatPoints(answer.maximumScore)}`}
        </span>
      </div>
    </div>
  );
}

function AttachmentSection({
  attachments,
  userId,
  requirement,
  instruction,
  canEdit,
  answerId,
  isLoading,
  isError,
  error,
  isBusy,
  onUpload,
  onRemove,
}: {
  attachments: IEBaselineAttachment[];
  userId: number;
  requirement: string | null;
  instruction: string | null;
  canEdit: boolean;
  answerId: number | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isBusy: boolean;
  onUpload: (file: File | undefined) => void;
  onRemove: (attachment: IEBaselineAttachment) => void;
}) {
  const fileInputId = answerId ? `attachment-upload-${answerId}` : 'attachment-upload-missing';
  const isRequired = requirement === 'required';
  const requiredInstruction = instruction?.trim() || 'Supporting evidence is required before finishing this checklist.';

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md border border-primary/20 bg-primary/10 flex items-center justify-center shrink-0">
            <Paperclip className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">{isRequired ? 'Required attachment' : 'Optional attachment'}</h4>
            <p className="text-xs text-muted-foreground">
              {isRequired ? requiredInstruction : 'Add supporting evidence if needed.'}
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="shrink-0">
            <Input
              id={fileInputId}
              type="file"
              className="sr-only"
              disabled={isBusy || !answerId}
              onChange={(event) => {
                onUpload(event.currentTarget.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            <Button asChild variant="outline" size="sm" className="gap-2" disabled={isBusy || !answerId}>
              <label htmlFor={fileInputId} className={cn('cursor-pointer', (isBusy || !answerId) && 'pointer-events-none')}>
                {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload
              </label>
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading attachments
          </div>
        )}

        {isError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Unable to load attachments.'}
          </div>
        )}

        {!isLoading && !isError && attachments.length === 0 && (
          <div className="rounded-md border border-dashed border-border bg-background/50 p-3 text-sm text-muted-foreground">
            No attachments uploaded for this answer yet.
          </div>
        )}

        {attachments.map((attachment) => (
          <div key={attachment.attachmentUnqId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-border bg-background/80 p-3">
            <div className="min-w-0 flex items-start gap-3">
              <FileText className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{attachment.originalFileName}</p>
                <p className="text-xs text-muted-foreground">
                  {[formatFileSize(attachment.fileSizeBytes), formatDateTime(attachment.createdAt)].filter(Boolean).join(' | ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Download attachment">
                <a href={ieBaselineApi.modules.attachments.downloadUrl(attachment.attachmentUnqId, userId)}>
                  <Download className="w-4 h-4" />
                  <span className="sr-only">Download attachment</span>
                </a>
              </Button>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Remove attachment"
                  disabled={isBusy}
                  onClick={() => onRemove(attachment)}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="sr-only">Remove attachment</span>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubmitValidationDialog({
  validation,
  questions,
  onOpenChange,
  onGoToQuestion,
}: {
  validation: IEBaselineValidationDetail | null;
  questions: IEBaselineAttemptQuestion[];
  onOpenChange: (open: boolean) => void;
  onGoToQuestion: (questionId: number) => void;
}) {
  const missing = validation?.missing_questions ?? validation?.unanswered_questions ?? [];
  const title = validation?.code === 'REQUIRED_ATTACHMENTS_MISSING'
    ? 'Required attachments missing'
    : 'Checklist needs attention';

  return (
    <Dialog open={Boolean(validation)} onOpenChange={onOpenChange}>
      <DialogContent className="z-[10000]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {validation?.message ?? 'Please review the highlighted questions before finishing.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {missing.map((item) => {
            const question = questions.find((candidate) => candidate.questionId === item.question_id);
            const label = item.question_num ?? item.question_no ?? question?.questionNo ?? item.question_id;

            return (
              <Button
                key={item.question_id}
                type="button"
                variant="outline"
                className="justify-start gap-2 text-left"
                onClick={() => onGoToQuestion(item.question_id)}
              >
                <ArrowRight className="w-4 h-4 shrink-0" />
                Question {label}
              </Button>
            );
          })}
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatFileSize(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[unitIndex]}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function QuestionContext({ question }: { question: { keyword: string | null; ibpmL2: string | null; ibpmL3: string | null; reference: string | null; memo: string | null } }) {
  const items = [
    ['Keyword', question.keyword],
    ['IBPM L2', question.ibpmL2],
    ['IBPM L3', question.ibpmL3],
    ['Reference', question.reference],
    ['Memo', question.memo],
  ].filter(([, value]) => Boolean(value));

  if (items.length === 0) return null;

  return (
    <div className="grid gap-2 text-white/70 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
          <span className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-1">{label}</span>
          {value}
        </div>
      ))}
    </div>
  );
}
