import type React from 'react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { AlertTriangle, CalendarClock, ClipboardList, Clock, Loader2, Search, UserRound, Users, X } from 'lucide-react';
import {
  ieBaselineApi,
  type IEBaselineAssignmentStatusGroup,
  type IEBaselineAssignmentStatusRow,
} from './api';
import { getRemainingDaysClass, getRemainingDaysLabel } from './IEBaseline';
import {
  ASSIGNMENT_STATUS_ALL,
  ASSIGNMENT_STATUS_OPTIONS,
  filterAssignmentStatusGroups,
  getAssignmentStatusClass,
  getAssignmentStatusSummary,
  type AssignmentStatusSelectValue,
} from './UserAssignmentStatusUtils';
import { useIEBaselineCurrentUser } from './useIEBaselineCurrentUser';

export default function UserAssignmentStatus() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssignmentStatusSelectValue>(ASSIGNMENT_STATUS_ALL);
  const {
    ieBaselineUserId,
    isLoading: isResolvingCurrentUser,
    error: currentUserResolveError,
  } = useIEBaselineCurrentUser();

  const {
    data,
    isLoading: isLoadingAssignments,
    isError,
    error: assignmentsError,
  } = useQuery({
    queryKey: ['iebaseline', 'assignment-status', ieBaselineUserId],
    queryFn: () => ieBaselineApi.assignmentStatus.list(ieBaselineUserId!),
    enabled: Boolean(ieBaselineUserId),
    refetchOnWindowFocus: false,
  });

  const groups = useMemo(() => data?.users ?? [], [data?.users]);
  const visibleGroups = useMemo(
    () => filterAssignmentStatusGroups(groups, search, statusFilter),
    [groups, search, statusFilter],
  );
  const summary = useMemo(() => getAssignmentStatusSummary(groups), [groups]);
  const visibleSummary = useMemo(() => getAssignmentStatusSummary(visibleGroups), [visibleGroups]);
  const hasFilters = search.trim().length > 0 || statusFilter !== ASSIGNMENT_STATUS_ALL;
  const isLoading = isResolvingCurrentUser || isLoadingAssignments;
  const error = currentUserResolveError ?? assignmentsError;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <h1 className="text-xl font-semibold text-foreground">Loading assignment status...</h1>
        <p className="text-sm text-muted-foreground">Fetching active user module assignments.</p>
      </div>
    );
  }

  if (error || isError) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Card className="border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">Unable to Load Assignment Status</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'Please check the IE Baseline API and try again.'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-col gap-2 px-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <ClipboardList className="h-6 w-6 text-primary" />
          User Assignment Status
        </h1>
        <p className="text-sm text-muted-foreground">
          Review active IE Baseline module assignments by learner.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile icon={Users} label="Visible Users" value={summary.users} />
        <SummaryTile icon={ClipboardList} label="Active Assignments" value={summary.assignments} />
        <SummaryTile icon={CalendarClock} label="Overdue" value={summary.overdue} tone={summary.overdue > 0 ? 'danger' : 'default'} />
        <SummaryTile icon={Clock} label="Submitted / Rejected" value={summary.submittedRejected} />
      </div>

      <Card className="overflow-hidden border-border/60 bg-background/70 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search user, WD ID, email, or module"
                className="pl-9"
                aria-label="Search assignment status"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AssignmentStatusSelectValue)}>
              <SelectTrigger className="w-full sm:w-[210px]" aria-label="Filter assignments by status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ASSIGNMENT_STATUS_ALL}>All Status</SelectItem>
                {ASSIGNMENT_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setSearch('');
                  setStatusFilter(ASSIGNMENT_STATUS_ALL);
                }}
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
          <p className="whitespace-nowrap text-sm text-muted-foreground">
            Showing {visibleSummary.assignments.toLocaleString()} of {summary.assignments.toLocaleString()} assignments
          </p>
        </div>

        {summary.assignments === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No active assignments"
            description="There are no active user checklist status rows to review."
          />
        ) : visibleGroups.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No assignments match your filters"
            description="Clear the search or status filter to review more assignments."
            action={(
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setSearch('');
                  setStatusFilter(ASSIGNMENT_STATUS_ALL);
                }}
              >
                <X className="h-4 w-4" />
                Clear filters
              </Button>
            )}
          />
        ) : (
          <AssignmentGroups groups={visibleGroups} />
        )}
      </Card>
    </div>
  );
}

function AssignmentGroups({ groups }: { groups: IEBaselineAssignmentStatusGroup[] }) {
  return (
    <Accordion type="multiple" className="w-full" defaultValue={groups.slice(0, 4).map((group) => String(group.user.user_id))}>
      {groups.map((group) => (
        <AccordionItem key={group.user.user_id} value={String(group.user.user_id)} className="border-b border-border/50 last:border-0">
          <AccordionTrigger className="px-4 py-4 hover:bg-muted/20 hover:no-underline">
            <div className="grid w-full grid-cols-12 items-center gap-4 pr-4 text-left">
              <div className="col-span-7 flex min-w-0 items-center gap-3 md:col-span-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background">
                  <UserRound className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{group.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    WD ID: {group.user.wd_id ?? 'N/A'}{group.user.email ? ` | ${group.user.email}` : ''}
                  </p>
                </div>
              </div>
              <div className="hidden min-w-0 text-xs text-muted-foreground md:col-span-3 md:block">
                <span className="block truncate">{group.user.department ?? 'No department'}</span>
                <span className="block truncate">{group.user.position ?? 'No position'}</span>
              </div>
              <div className="col-span-5 flex items-center justify-end gap-2 md:col-span-4">
                <Badge variant="outline">{group.assignments.length} active</Badge>
                <Badge variant="outline" className="hidden sm:inline-flex">
                  {group.assignments.filter((assignment) => assignment.status === 'Submitted').length} submitted
                </Badge>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border/50 bg-muted/5 p-0">
            <AssignmentTable assignments={group.assignments} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function AssignmentTable({ assignments }: { assignments: IEBaselineAssignmentStatusRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="min-w-[260px]">Module</TableHead>
            <TableHead className="min-w-[150px]">Status</TableHead>
            <TableHead className="min-w-[170px]">Progress</TableHead>
            <TableHead className="min-w-[150px]">Deadline</TableHead>
            <TableHead className="min-w-[150px]">Assigned By</TableHead>
            <TableHead className="min-w-[140px]">Assigned</TableHead>
            <TableHead className="min-w-[140px]">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((assignment) => {
            const progress = assignment.status === 'Not Started' ? 0 : clampProgress(assignment.progress);
            return (
              <TableRow key={assignment.assignment_id}>
                <TableCell>
                  <div className="min-w-0">
                    <p className="max-w-[340px] truncate font-medium text-foreground">{assignment.module_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {assignment.question_count} question{assignment.question_count === 1 ? '' : 's'}
                      {assignment.owner_name ? ` | Owner: ${assignment.owner_name}` : ''}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn('border font-semibold', getAssignmentStatusClass(assignment.status))}>
                    {assignment.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Progress value={progress} className="h-2 min-w-24 bg-muted" />
                    <span className="w-10 text-right text-xs font-medium text-muted-foreground">{progress}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-foreground">{assignment.deadline_date ? formatDate(assignment.deadline_date) : 'No deadline'}</div>
                  <div className={cn('text-xs', getRemainingDaysClass(assignment.remaining_days))}>
                    {getRemainingDaysLabel(assignment.remaining_days)}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{assignment.assigned_by?.name ?? 'N/A'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(assignment.assigned_at)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(assignment.updated_at)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: 'default' | 'danger';
}) {
  return (
    <Card className={cn('border-border/60 bg-background/70 p-4 shadow-sm', tone === 'danger' && 'border-red-500/30 bg-red-500/5')}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold text-foreground">{value.toLocaleString()}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary', tone === 'danger' && 'bg-red-500/10 text-red-600')}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
      <Icon className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

function clampProgress(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
