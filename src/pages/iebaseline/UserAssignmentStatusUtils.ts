import type {
  IEBaselineAssignmentStatusFilter,
  IEBaselineAssignmentStatusGroup,
  IEBaselineHomeStatus,
} from './api';

export const ASSIGNMENT_STATUS_ALL = 'all';
export const ASSIGNMENT_STATUS_OPTIONS: IEBaselineAssignmentStatusFilter[] = ['Not Started', 'In Progress', 'Submitted', 'Rejected'];
export type AssignmentStatusSelectValue = typeof ASSIGNMENT_STATUS_ALL | IEBaselineAssignmentStatusFilter;

export function flattenAssignmentStatusGroups(groups: IEBaselineAssignmentStatusGroup[]) {
  return groups.flatMap((group) =>
    group.assignments
      .filter((assignment) => assignment.status !== 'Completed')
      .map((assignment) => ({ user: group.user, assignment })),
  );
}

export function filterAssignmentStatusGroups(
  groups: IEBaselineAssignmentStatusGroup[],
  search: string,
  statusFilter: AssignmentStatusSelectValue,
): IEBaselineAssignmentStatusGroup[] {
  const query = normalizeSearch(search);

  return groups
    .map((group) => {
      const userMatches = [
        group.user.name,
        group.user.email,
        group.user.wd_id === null || group.user.wd_id === undefined ? null : String(group.user.wd_id),
      ].some((value) => normalizeSearch(value).includes(query));

      const assignments = group.assignments.filter((assignment) => {
        if (assignment.status === 'Completed') return false;

        const matchesStatus = statusFilter === ASSIGNMENT_STATUS_ALL || assignment.status === statusFilter;
        const matchesSearch = !query || userMatches || normalizeSearch(assignment.module_name).includes(query);

        return matchesSearch && matchesStatus;
      });

      return { ...group, assignments };
    })
    .filter((group) => group.assignments.length > 0);
}

export function getAssignmentStatusSummary(groups: IEBaselineAssignmentStatusGroup[]) {
  const activeRows = flattenAssignmentStatusGroups(groups);

  return {
    users: new Set(activeRows.map((row) => row.user.user_id)).size,
    assignments: activeRows.length,
    overdue: activeRows.filter((row) => typeof row.assignment.remaining_days === 'number' && row.assignment.remaining_days < 0).length,
    submittedRejected: activeRows.filter((row) => row.assignment.status === 'Submitted' || row.assignment.status === 'Rejected').length,
  };
}

export function getAssignmentStatusClass(status: IEBaselineHomeStatus) {
  switch (status) {
    case 'In Progress':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/25';
    case 'Submitted':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/25';
    case 'Rejected':
      return 'bg-red-500/10 text-red-600 border-red-500/25';
    case 'Completed':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25';
    case 'Not Started':
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function normalizeSearch(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}
