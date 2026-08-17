import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortHeader } from '@/components/shared/SortHeader';
import { ClipboardList, Eye, Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSortable } from '@/hooks/shared/useSortable';
import { ieBaselineApi, type IEBaselineAttemptHistoryItem } from './api';
import { useIEBaselineCurrentUser } from './useIEBaselineCurrentUser';

const ALL_STATUSES = 'all';
type AttemptSortKey = 'module' | 'attempt' | 'status' | 'score' | 'resultDate';

const attemptSortAccessors: Record<AttemptSortKey, (attempt: IEBaselineAttemptHistoryItem) => string | number | null | undefined> = {
  module: (attempt) => getModuleLabel(attempt),
  attempt: (attempt) => attempt.attemptNo,
  status: (attempt) => formatStatus(attempt.resultStatus),
  score: (attempt) => attempt.score,
  resultDate: (attempt) => getAttemptSortTime(attempt),
};

export default function PreviousAttempts() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
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

  const statusOptions = useMemo(
    () => Array.from(new Set(attempts.map((attempt) => formatStatus(attempt.resultStatus)))).sort(),
    [attempts],
  );

  const filteredAttempts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return attempts.filter((attempt) => {
      const matchesSearch = query.length === 0 || getModuleLabel(attempt).toLowerCase().includes(query);
      const matchesStatus = statusFilter === ALL_STATUSES || formatStatus(attempt.resultStatus) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [attempts, search, statusFilter]);

  const { sorted: visibleAttempts, sort, toggle } = useSortable(
    filteredAttempts,
    attemptSortAccessors,
    { key: 'resultDate', dir: 'desc' },
  );

  const hasFilters = search.trim().length > 0 || statusFilter !== ALL_STATUSES;
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
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <ClipboardList className="h-6 w-6 text-primary" />
          Previous Attempts
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Review submitted, approved, and rejected checklist attempts.</p>
      </div>

      <Card className="overflow-hidden border-border/60 bg-background/70 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search module name..."
                className="pl-9"
                aria-label="Search attempts by module name"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[210px]" aria-label="Filter attempts by status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUSES}>All Status</SelectItem>
                {statusOptions.map((status) => (
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
                  setStatusFilter(ALL_STATUSES);
                }}
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
          <p className="whitespace-nowrap text-sm text-muted-foreground">
            Showing {visibleAttempts.length.toLocaleString()} of {attempts.length.toLocaleString()} attempts
          </p>
        </div>

        {attempts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">No previous attempts are available yet.</p>
          </div>
        ) : visibleAttempts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Search className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">No attempts match your filters.</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => {
                setSearch('');
                setStatusFilter(ALL_STATUSES);
              }}
            >
              <X className="h-4 w-4" />
              Clear filters
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="min-w-[280px]">
                  <SortHeader label="Module" active={sort?.key === 'module'} dir={sort?.dir} onClick={() => toggle('module')} />
                </TableHead>
                <TableHead className="min-w-[120px]">
                  <SortHeader label="Attempt" active={sort?.key === 'attempt'} dir={sort?.dir} onClick={() => toggle('attempt')} />
                </TableHead>
                <TableHead className="min-w-[160px]">
                  <SortHeader label="Status" active={sort?.key === 'status'} dir={sort?.dir} onClick={() => toggle('status')} />
                </TableHead>
                <TableHead className="min-w-[120px]">
                  <SortHeader label="Score" active={sort?.key === 'score'} dir={sort?.dir} onClick={() => toggle('score')} />
                </TableHead>
                <TableHead className="min-w-[160px]">
                  <SortHeader label="Result Date" active={sort?.key === 'resultDate'} dir={sort?.dir} onClick={() => toggle('resultDate')} />
                </TableHead>
                <TableHead className="min-w-[110px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleAttempts.map((attempt) => (
                <TableRow key={attempt.attemptId}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="max-w-[340px] truncate font-medium text-foreground">{getModuleLabel(attempt)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Module ID: {attempt.moduleId}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">#{attempt.attemptNo}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('border font-semibold', getResultStatusClass(attempt.resultStatus))}>
                      {formatStatus(attempt.resultStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{formatScore(attempt.score)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(getResultDate(attempt))}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost" className="gap-2">
                      <Link to={`/iebaseline/attempts/${attempt.attemptId}/results`}>
                        <Eye className="h-4 w-4" />
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function getModuleLabel(attempt: IEBaselineAttemptHistoryItem) {
  return attempt.moduleName ?? `Module ${attempt.moduleId}`;
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

function formatStatus(status: string | null | undefined) {
  return status?.trim() || 'Unknown';
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
