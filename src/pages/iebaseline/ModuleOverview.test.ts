import { describe, expect, it } from 'vitest';
import { getLatestRejectedAttempt } from './ModuleOverview';
import type { IEBaselineAttemptHistoryItem } from './api';

const attempt = (overrides: Partial<IEBaselineAttemptHistoryItem>): IEBaselineAttemptHistoryItem => ({
  attemptId: 1,
  moduleId: 10,
  moduleName: 'Module',
  attemptNo: 1,
  attemptStatus: 'Completed',
  resultStatus: 'APPROVED',
  answeredQuestions: 0,
  totalQuestions: 0,
  correctAnswers: 0,
  score: null,
  progressPercentage: 0,
  startedAt: null,
  lastSavedAt: null,
  submittedAt: null,
  completedAt: null,
  ...overrides,
});

describe('getLatestRejectedAttempt', () => {
  it('selects the newest rejected attempt by completed, submitted, saved, then started time', () => {
    const selected = getLatestRejectedAttempt([
      attempt({
        attemptId: 1,
        attemptStatus: 'Rejected',
        resultStatus: 'REJECTED',
        completedAt: '2026-08-15T08:00:00+08:00',
      }),
      attempt({
        attemptId: 2,
        attemptStatus: 'Rejected',
        resultStatus: 'REJECTED',
        submittedAt: '2026-08-16T08:00:00+08:00',
      }),
      attempt({
        attemptId: 3,
        attemptStatus: 'Rejected',
        resultStatus: 'REJECTED',
        completedAt: '2026-08-17T08:00:00+08:00',
      }),
    ]);

    expect(selected?.attemptId).toBe(3);
  });

  it('ignores non-rejected attempts', () => {
    const selected = getLatestRejectedAttempt([
      attempt({ attemptId: 1, attemptStatus: 'Completed', resultStatus: 'APPROVED' }),
      attempt({ attemptId: 2, attemptStatus: 'Submitted', resultStatus: 'PENDING' }),
    ]);

    expect(selected).toBeUndefined();
  });
});
