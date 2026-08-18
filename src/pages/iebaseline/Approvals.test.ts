import { describe, expect, it } from 'vitest';
import { getVisibleIEBaselineApprovalTabs } from './Approvals';
import { canDelegateApproval } from './approvalUtils';

describe('IE Baseline approval tab visibility', () => {
  it('returns only my-submissions when inbox is denied', () => {
    const visibleTabs = getVisibleIEBaselineApprovalTabs(
      (path) => path === '/iebaseline/approvals/my-submissions',
    );

    expect(visibleTabs).toEqual(['my-submissions']);
  });

  it('returns only inbox when submissions are denied', () => {
    const visibleTabs = getVisibleIEBaselineApprovalTabs(
      (path) => path === '/iebaseline/approvals/inbox',
    );

    expect(visibleTabs).toEqual(['inbox']);
  });

  it('returns both tabs when both approval routes are granted', () => {
    const visibleTabs = getVisibleIEBaselineApprovalTabs(
      (path) => path.startsWith('/iebaseline/approvals/'),
    );

    expect(visibleTabs).toEqual(['my-submissions', 'inbox']);
  });
});

describe('IE Baseline approval delegation visibility', () => {
  it('shows delegation for actionable inbox approvals', () => {
    expect(canDelegateApproval({ status: 'PENDING' }, 'inbox')).toBe(true);
    expect(canDelegateApproval({ status: 'IN_PROGRESS' }, 'inbox')).toBe(true);
  });

  it('hides delegation outside actionable inbox approvals', () => {
    expect(canDelegateApproval({ status: 'APPROVED' }, 'inbox')).toBe(false);
    expect(canDelegateApproval({ status: 'REJECTED' }, 'inbox')).toBe(false);
    expect(canDelegateApproval({ status: 'CANCELLED' }, 'inbox')).toBe(false);
    expect(canDelegateApproval({ status: 'PENDING' }, 'submissions')).toBe(false);
  });
});
