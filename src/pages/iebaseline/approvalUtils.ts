import type { IEBaselineApprovalListItem } from './api';

export function canDelegateApproval(approval: Pick<IEBaselineApprovalListItem, 'status'>, mode: 'submissions' | 'inbox') {
  return mode === 'inbox' && (approval.status === 'PENDING' || approval.status === 'IN_PROGRESS');
}
