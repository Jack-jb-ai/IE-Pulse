import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronRight, ClipboardCheck, Eye, Inbox, Loader2, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  ieBaselineApi,
  type IEBaselineApprovalListItem,
  type IEBaselineApprovalStatus,
} from './api';
import { useIEBaselineRouteAccess } from './access';
import ExamModal from './components/ExamModal';
import { useIEBaselineCurrentUser } from './useIEBaselineCurrentUser';

export type ApprovalTab = 'my-submissions' | 'inbox';
type InboxFilter = IEBaselineApprovalStatus | 'ACTIONABLE';

interface ApprovalsProps {
  defaultTab?: ApprovalTab;
}

const inboxFilters: InboxFilter[] = ['ACTIONABLE', 'PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED'];
const APPROVAL_TAB_ROUTES: Record<ApprovalTab, string> = {
  'my-submissions': '/iebaseline/approvals/my-submissions',
  inbox: '/iebaseline/approvals/inbox',
};

export function getVisibleIEBaselineApprovalTabs(canView: (path: string) => boolean): ApprovalTab[] {
  return (Object.keys(APPROVAL_TAB_ROUTES) as ApprovalTab[]).filter((tab) => canView(APPROVAL_TAB_ROUTES[tab]));
}

export default function Approvals({ defaultTab = 'my-submissions' }: ApprovalsProps) {
  const navigate = useNavigate();
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('ACTIONABLE');
  const {
    ieBaselineUserId,
    isLoading: isResolvingAccess,
    error: accessError,
    canView,
  } = useIEBaselineRouteAccess();
  const canViewSubmissions = canView(APPROVAL_TAB_ROUTES['my-submissions']);
  const canViewInbox = canView(APPROVAL_TAB_ROUTES.inbox);
  const visibleTabs = getVisibleIEBaselineApprovalTabs(canView);
  const activeTab = visibleTabs.includes(defaultTab) ? defaultTab : visibleTabs[0] ?? defaultTab;
  const showTabsList = visibleTabs.length > 1;

  const submissionsQuery = useQuery({
    queryKey: ['iebaseline', 'approvals', 'my-submissions', ieBaselineUserId],
    queryFn: () => ieBaselineApi.approvals.listMySubmissions(ieBaselineUserId!),
    enabled: Boolean(ieBaselineUserId && canViewSubmissions),
    refetchOnWindowFocus: false,
  });

  const inboxQuery = useQuery({
    queryKey: ['iebaseline', 'approvals', 'inbox', ieBaselineUserId, inboxFilter],
    queryFn: () => ieBaselineApi.approvals.listInbox(ieBaselineUserId!, inboxFilter),
    enabled: Boolean(ieBaselineUserId && canViewInbox),
    refetchOnWindowFocus: false,
  });

  const inboxItems = useMemo(() => {
    const approvals = inboxQuery.data?.approvals ?? [];
    return inboxFilter === 'ACTIONABLE'
      ? approvals.filter((item) => item.status === 'PENDING' || item.status === 'IN_PROGRESS')
      : approvals;
  }, [inboxFilter, inboxQuery.data?.approvals]);

  const isLoading = isResolvingAccess;
  const error = accessError;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <h1 className="text-xl font-semibold text-foreground">Loading approvals...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">Unable to Load Approvals</h1>
        <p className="max-w-lg text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">IE Baseline</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Approvals</h1>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/iebaseline">
            Dashboard
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => navigate(`/iebaseline/approvals/${value}`)}
        className="space-y-5"
      >
        {showTabsList && (
          <TabsList className="grid w-full max-w-md grid-cols-2">
            {canViewSubmissions && (
              <TabsTrigger value="my-submissions" className="gap-2">
                <Send className="h-4 w-4" />
                My Submissions
              </TabsTrigger>
            )}
            {canViewInbox && (
              <TabsTrigger value="inbox" className="gap-2">
                <Inbox className="h-4 w-4" />
                Approval Inbox
              </TabsTrigger>
            )}
          </TabsList>
        )}

        {canViewSubmissions && (
          <TabsContent value="my-submissions">
            <ApprovalList
              title="My Submissions"
              description="Approval requests created from your submitted checklists."
              approvals={submissionsQuery.data?.approvals ?? []}
              isLoading={submissionsQuery.isLoading}
              error={submissionsQuery.error}
              emptyLabel="No submitted approvals yet."
              mode="submissions"
            />
          </TabsContent>
        )}

        {canViewInbox && (
          <TabsContent value="inbox">
            <ApprovalList
              title="Approval Inbox"
              description="Checklist submissions assigned to you for review."
              approvals={inboxItems}
              isLoading={inboxQuery.isLoading}
              error={inboxQuery.error}
              emptyLabel="No approval requests match this filter."
              mode="inbox"
              rightSlot={
                <Select value={inboxFilter} onValueChange={(value) => setInboxFilter(value as InboxFilter)}>
                  <SelectTrigger className="w-full sm:w-[210px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {inboxFilters.map((filter) => (
                      <SelectItem key={filter} value={filter}>{filter === 'ACTIONABLE' ? 'Actionable' : filter}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export function ApprovalReviewRoute() {
  const navigate = useNavigate();
  const { approvalId } = useParams<{ approvalId: string }>();
  const numericApprovalId = Number(approvalId);
  const {
    ieBaselineUserId,
    isLoading,
    error,
  } = useIEBaselineCurrentUser();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading approval review
      </div>
    );
  }

  if (error || !Number.isFinite(numericApprovalId) || !ieBaselineUserId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">Unable to Open Review</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'The approval ID in the URL is invalid.'}
        </p>
        <Button asChild><Link to="/iebaseline/approvals/inbox">Return to Inbox</Link></Button>
      </div>
    );
  }

  return (
    <ExamModal
      moduleId={0}
      moduleName={`Approval #${numericApprovalId}`}
      userId={ieBaselineUserId}
      approvalId={numericApprovalId}
      onClose={() => navigate('/iebaseline/approvals/inbox')}
    />
  );
}

function ApprovalList({
  title,
  description,
  approvals,
  isLoading,
  error,
  emptyLabel,
  mode,
  rightSlot,
}: {
  title: string;
  description: string;
  approvals: IEBaselineApprovalListItem[];
  isLoading: boolean;
  error: unknown;
  emptyLabel: string;
  mode: 'submissions' | 'inbox';
  rightSlot?: ReactNode;
}) {
  return (
    <Card className="border-border/60 bg-background/70 p-0 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {rightSlot}
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading approvals
        </div>
      )}

      {error && (
        <div className="m-5 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Unable to load approval requests.'}
        </div>
      )}

      {!isLoading && !error && approvals.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <ClipboardCheck className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">{emptyLabel}</p>
        </div>
      )}

      {!isLoading && !error && approvals.length > 0 && (
        <div className="divide-y divide-border/60">
          {approvals.map((approval) => (
            <ApprovalRow key={approval.approvalId} approval={approval} mode={mode} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ApprovalRow({ approval, mode }: { approval: IEBaselineApprovalListItem; mode: 'submissions' | 'inbox' }) {
  const canReview = mode === 'inbox';

  return (
    <div className="grid gap-4 p-5 lg:grid-cols-[1.4fr_1fr_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={getStatusClass(approval.status)}>{approval.status}</Badge>
          <span className="text-xs font-medium text-muted-foreground">Attempt #{approval.attemptNo}</span>
        </div>
        <h3 className="mt-2 truncate text-base font-semibold text-foreground">{approval.moduleName}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Learner: {approval.learner?.name ?? 'N/A'} · Approver: {approval.approver?.name ?? 'N/A'}
        </p>
      </div>

      <div className="grid gap-1 text-sm text-muted-foreground">
        <span>Submitted: <strong className="font-medium text-foreground">{formatDateTime(approval.submittedAt)}</strong></span>
        <span>Completed: <strong className="font-medium text-foreground">{formatDateTime(approval.completedAt ?? approval.attemptCompletedAt)}</strong></span>
        <span>Score: <strong className="font-medium text-foreground">{approval.score === null || approval.score === undefined ? 'Pending' : `${approval.score}%`}</strong></span>
        {approval.remarks && <span className="line-clamp-1">Remarks: {approval.remarks}</span>}
      </div>

      <div className="flex justify-end">
        {canReview ? (
          <Button asChild className="gap-2">
            <Link to={`/iebaseline/approvals/${approval.approvalId}/review`}>
              <Eye className="h-4 w-4" />
              Review
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" className="gap-2">
            <Link to={`/iebaseline/module/${approval.moduleId}/results`}>
              <Eye className="h-4 w-4" />
              Result
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function getStatusClass(status: IEBaselineApprovalStatus) {
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
