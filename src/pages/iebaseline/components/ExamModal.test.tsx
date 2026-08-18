import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ExamModal from './ExamModal';
import type { IEBaselineAttempt, IEBaselineAttemptQuestionsResponse, IEBaselineStartAttemptResponse } from '../api';

const apiMock = vi.hoisted(() => ({
  modules: {
    attempts: {
      start: vi.fn(),
      list: vi.fn(),
    },
    attachments: {
      list: vi.fn(),
      upload: vi.fn(),
      remove: vi.fn(),
      downloadUrl: vi.fn(() => '#'),
    },
  },
  attempts: {
    questions: {
      get: vi.fn(),
      saveAnswer: vi.fn(),
      clearAnswer: vi.fn(),
    },
    submit: vi.fn(),
  },
  approvals: {
    start: vi.fn(),
    getReview: vi.fn(),
    updateAnswer: vi.fn(),
    decision: vi.fn(),
  },
}));

vi.mock('../api', async (importActual) => ({
  ...(await importActual<typeof import('../api')>()),
  ieBaselineApi: apiMock,
}));

const attempt = (overrides: Partial<IEBaselineAttempt> = {}): IEBaselineAttempt => ({
  attemptId: 101,
  moduleId: 3,
  moduleName: 'Safety Basics',
  attemptNo: 1,
  attemptStatus: 'In Progress',
  resultStatus: 'PENDING',
  answeredQuestions: 1,
  totalQuestions: 1,
  correctAnswers: 0,
  score: null,
  progressPercentage: 100,
  startedAt: '2026-08-18T08:00:00+08:00',
  lastSavedAt: '2026-08-18T08:05:00+08:00',
  submittedAt: null,
  completedAt: null,
  ...overrides,
});

const questionsResponse = (activeAttempt: IEBaselineAttempt): IEBaselineAttemptQuestionsResponse => ({
  attempt: activeAttempt,
  progress: {
    answeredQuestions: 1,
    totalQuestions: 1,
    progressPercentage: 100,
    lastSavedAt: activeAttempt.lastSavedAt,
  },
  questions: [
    {
      id: 1,
      questionId: 11,
      moduleId: activeAttempt.moduleId,
      moduleName: activeAttempt.moduleName,
      category: null,
      keyword: null,
      ibpmL2: null,
      ibpmL3: null,
      risk: null,
      questionNo: 1,
      question: 'Question?',
      options: 'Yes|No',
      attachmentRequirement: 'none',
      attachmentInstruction: null,
      attachmentApprovalRequired: null,
      reference: null,
      memo: null,
      answer: {
        answerId: 501,
        selectedAnswer: 'Yes',
        isAnswered: true,
        isAttached: false,
        isCorrect: null,
        scoreAwarded: null,
        maximumScore: null,
        lastSavedAt: activeAttempt.lastSavedAt,
      },
    },
  ],
});

function renderModal(props: Partial<ComponentProps<typeof ExamModal>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ExamModal
          moduleId={3}
          moduleName="Safety Basics"
          userId={7}
          onClose={vi.fn()}
          {...props}
        />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

describe('ExamModal attempt entry', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads an initial rejected attempt without calling start', async () => {
    const rejectedAttempt = attempt({
      attemptId: 303,
      attemptStatus: 'Rejected',
      resultStatus: 'REJECTED',
      submittedAt: '2026-08-17T08:00:00+08:00',
      completedAt: '2026-08-17T09:00:00+08:00',
    });
    apiMock.attempts.questions.get.mockResolvedValueOnce(questionsResponse(rejectedAttempt));

    renderModal({ initialAttemptId: 303 });

    await waitFor(() => {
      expect(apiMock.attempts.questions.get).toHaveBeenCalledWith(303, 7);
    });
    expect(apiMock.modules.attempts.start).not.toHaveBeenCalled();
  });

  it('uses start/resume when no initial attempt is provided', async () => {
    const startedAttempt = attempt({ attemptId: 404 });
    const startResponse: IEBaselineStartAttemptResponse = {
      attempt: startedAttempt,
      progress: {
        answeredQuestions: 0,
        totalQuestions: 1,
        progressPercentage: 0,
        lastSavedAt: null,
      },
    };
    apiMock.modules.attempts.start.mockResolvedValueOnce(startResponse);
    apiMock.attempts.questions.get.mockResolvedValueOnce(questionsResponse(startedAttempt));

    renderModal();

    await waitFor(() => {
      expect(apiMock.modules.attempts.start).toHaveBeenCalledWith(3, 7);
    });
    await waitFor(() => {
      expect(apiMock.attempts.questions.get).toHaveBeenCalledWith(404, 7);
    });
  });
});
