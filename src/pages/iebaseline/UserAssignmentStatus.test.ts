import { describe, expect, it } from 'vitest';
import type { IEBaselineAssignmentStatusGroup } from './api';
import {
  ASSIGNMENT_STATUS_ALL,
  filterAssignmentStatusGroups,
  flattenAssignmentStatusGroups,
  getAssignmentStatusSummary,
} from './UserAssignmentStatusUtils';
import { getRemainingDaysClass, getRemainingDaysLabel } from './IEBaseline';

const groups: IEBaselineAssignmentStatusGroup[] = [
  {
    user: {
      user_id: 1,
      name: 'Jane Tan',
      position: 'Manager',
      wd_id: 12345,
      email: 'jane@example.com',
      department: 'IE',
    },
    assignments: [
      {
        assignment_id: 10,
        module_id: 100,
        module_name: 'Order to Cash',
        description: null,
        owner_name: 'Finance',
        assigned_by: { user_id: 7, name: 'Admin User' },
        status: 'Not Started',
        raw_status: 'Not Started',
        progress: 0,
        assigned_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
        deadline_date: '2026-08-30',
        remaining_days: 4,
        question_count: 12,
      },
      {
        assignment_id: 11,
        module_id: 101,
        module_name: 'Completed Legacy Row',
        description: null,
        owner_name: null,
        assigned_by: null,
        status: 'Completed',
        raw_status: 'Completed',
        progress: 100,
        assigned_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
        deadline_date: null,
        remaining_days: null,
        question_count: 4,
      },
    ],
  },
  {
    user: {
      user_id: 2,
      name: 'Adam Lee',
      position: 'Engineer',
      wd_id: 67890,
      email: 'adam@example.com',
      department: 'Operations',
    },
    assignments: [
      {
        assignment_id: 20,
        module_id: 200,
        module_name: 'Lean Manufacturing',
        description: null,
        owner_name: 'Ops',
        assigned_by: { user_id: 7, name: 'Admin User' },
        status: 'Submitted',
        raw_status: 'Submitted',
        progress: 100,
        assigned_at: '2026-08-03T00:00:00Z',
        updated_at: '2026-08-04T00:00:00Z',
        deadline_date: '2026-08-20',
        remaining_days: -6,
        question_count: 8,
      },
      {
        assignment_id: 21,
        module_id: 201,
        module_name: 'Quality Control',
        description: null,
        owner_name: 'Quality',
        assigned_by: { user_id: 8, name: 'Dev User' },
        status: 'Rejected',
        raw_status: 'Rejected',
        progress: 80,
        assigned_at: '2026-08-03T00:00:00Z',
        updated_at: '2026-08-05T00:00:00Z',
        deadline_date: '2026-08-26',
        remaining_days: 0,
        question_count: 6,
      },
    ],
  },
];

describe('UserAssignmentStatus helpers', () => {
  it('excludes completed assignments from flattened status rows', () => {
    const rows = flattenAssignmentStatusGroups(groups);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.assignment.module_name)).not.toContain('Completed Legacy Row');
  });

  it('searches by user, WD ID, email, and module name', () => {
    expect(filterAssignmentStatusGroups(groups, 'jane', ASSIGNMENT_STATUS_ALL)).toHaveLength(1);
    expect(filterAssignmentStatusGroups(groups, '67890', ASSIGNMENT_STATUS_ALL)[0].user.name).toBe('Adam Lee');
    expect(filterAssignmentStatusGroups(groups, 'adam@example.com', ASSIGNMENT_STATUS_ALL)[0].user.user_id).toBe(2);
    expect(filterAssignmentStatusGroups(groups, 'quality', ASSIGNMENT_STATUS_ALL)[0].assignments[0].module_name).toBe('Quality Control');
  });

  it('filters by active assignment status', () => {
    const submittedGroups = filterAssignmentStatusGroups(groups, '', 'Submitted');

    expect(submittedGroups).toHaveLength(1);
    expect(submittedGroups[0].assignments).toHaveLength(1);
    expect(submittedGroups[0].assignments[0].status).toBe('Submitted');
  });

  it('summarizes active users, active rows, overdue rows, and submitted or rejected rows', () => {
    expect(getAssignmentStatusSummary(groups)).toEqual({
      users: 2,
      assignments: 3,
      overdue: 1,
      submittedRejected: 2,
    });
  });

  it('labels remaining days consistently', () => {
    expect(getRemainingDaysLabel(-6)).toBe('6 days overdue');
    expect(getRemainingDaysClass(-6)).toBe('text-red-600');
    expect(getRemainingDaysLabel(0)).toBe('Due today');
    expect(getRemainingDaysClass(0)).toBe('text-amber-600');
  });
});
