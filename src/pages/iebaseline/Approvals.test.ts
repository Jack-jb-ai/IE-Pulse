import { describe, expect, it } from 'vitest';
import { getVisibleIEBaselineApprovalTabs } from './Approvals';

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
