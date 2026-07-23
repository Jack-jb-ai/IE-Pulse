export const IEBASELINE_DEMO_USER_ID = 1;

const BASE = '/ietools/iebaseline/api';

export type IEBaselineHomeStatus = 'Not Started' | 'Completed';
export type IEBaselineRawChecklistStatus = 'Incomplete' | 'Completed';

export interface IEBaselineHomeUser {
  user_id: number;
  name: string;
  position: string | null;
  wd_id: number | null;
}

export interface IEBaselineHomeAssignment {
  assignment_id: number;
  module_id: number;
  module_name: string;
  description: string | null;
  owner_name: string | null;
  assigned_by: {
    user_id: number;
    name: string;
  } | null;
  status: IEBaselineHomeStatus;
  raw_status: IEBaselineRawChecklistStatus;
  progress: 0 | 100;
  assigned_at: string;
  updated_at: string;
  question_count: number;
}

export interface IEBaselineHomeResponse {
  user: IEBaselineHomeUser;
  assignments: IEBaselineHomeAssignment[];
}

export interface IEBaselineUser {
  user_id: number;
  name: string;
  position: string | null;
  wd_id: number | null;
  assigned_module_count?: number | null;
}

export interface IEBaselineModule {
  module_id: number;
  module_name: string;
  description: string | null;
  owner_name: string | null;
  question_count?: number | null;
}

export interface IEBaselineModuleQuestion {
  id: number;
  module_id: number;
  module_name: string;
  category: string | null;
  keyword: string | null;
  ibpm_l2: string | null;
  ibpm_l3: string | null;
  risk: string | null;
  question_no: number | string | null;
  question: string;
  options: string | null;
  reference: string | null;
  memo: string | null;
}

export interface IEBaselineUserModulesResponse {
  user: IEBaselineHomeUser;
  assigned_module_ids: number[];
}

export interface IEBaselineUpdateUserModulesRequest {
  module_ids: number[];
  assignee_id: number;
}

export interface IEBaselineUpdateUserModulesResponse {
  user_id: number;
  assigned_module_ids: number[];
  added_module_ids: number[];
  removed_module_ids: number[];
  unchanged_module_ids: number[];
}

export type IEBaselineExamAttemptStatus = 'Not Started' | 'In Progress' | 'Submitted' | 'Completed' | 'Abandoned';
export type IEBaselineExamResultStatus = 'Pending' | 'Passed' | 'Failed';

export interface IEBaselineAttemptProgress {
  answeredQuestions: number;
  totalQuestions: number;
  progressPercentage: number;
  lastSavedAt: string | null;
}

export interface IEBaselineAttempt {
  attemptId: number;
  moduleId: number;
  attemptNo: number;
  attemptStatus: IEBaselineExamAttemptStatus;
  resultStatus: IEBaselineExamResultStatus;
  answeredQuestions: number;
  totalQuestions: number;
  correctAnswers: number;
  score: number | null;
  progressPercentage: number;
  startedAt: string | null;
  lastSavedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
}

export interface IEBaselineStartAttemptResponse {
  attempt: IEBaselineAttempt;
  progress: IEBaselineAttemptProgress;
}

export interface IEBaselineStartAttemptRequest {
  userId: number;
}

export interface IEBaselineAttemptAnswer {
  answerId: number | null;
  selectedAnswer: string | null;
  isAnswered: boolean;
  isCorrect: boolean | null;
  scoreAwarded: number | null;
  maximumScore: number | null;
  lastSavedAt: string | null;
}

export interface IEBaselineAttemptQuestion {
  id: number;
  questionId: number;
  moduleId: number;
  moduleName: string | null;
  category: string | null;
  keyword: string | null;
  ibpmL2: string | null;
  ibpmL3: string | null;
  risk: string | null;
  questionNo: number | string | null;
  question: string;
  options: string | null;
  reference: string | null;
  memo: string | null;
  answer: IEBaselineAttemptAnswer;
}

export interface IEBaselineAttemptQuestionsResponse {
  attempt: IEBaselineAttempt;
  progress: IEBaselineAttemptProgress;
  questions: IEBaselineAttemptQuestion[];
}

export interface IEBaselineSaveAnswerRequest {
  selectedAnswer: string | null;
}

export interface IEBaselineSaveAnswerResponse {
  attemptId: number;
  questionId: number;
  selectedAnswer: string | null;
  isAnswered: boolean;
  answeredQuestions: number;
  totalQuestions: number;
  progressPercentage: number;
  lastSavedAt: string;
}

export interface IEBaselineSubmitAttemptResponse {
  attempt: IEBaselineAttempt;
  progress: IEBaselineAttemptProgress;
}

export type IEBaselineAttemptHistoryItem = IEBaselineAttempt;
type IEBaselineAttemptHistoryResponse = IEBaselineAttemptHistoryItem[] | { attempts: IEBaselineAttemptHistoryItem[] };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = typeof body?.detail === 'string' ? `: ${body.detail}` : '';
    } catch {
      detail = '';
    }

    throw new Error(`IE Baseline API ${path} -> ${res.status}${detail}`);
  }

  return res.json() as Promise<T>;
}

async function sendJson<TResponse, TBody = undefined>(method: 'PUT' | 'POST' | 'DELETE', path: string, body?: TBody): Promise<TResponse> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : {
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const responseBody = await res.json();
      detail = typeof responseBody?.detail === 'string' ? `: ${responseBody.detail}` : '';
    } catch {
      detail = '';
    }

    throw new Error(`IE Baseline API ${path} -> ${res.status}${detail}`);
  }

  return res.json() as Promise<TResponse>;
}

export const ieBaselineApi = {
  home: {
    get: (userId = IEBASELINE_DEMO_USER_ID) =>
      get<IEBaselineHomeResponse>(`/home?user_id=${encodeURIComponent(String(userId))}`),
  },
  users: {
    list: () => get<IEBaselineUser[]>('/users'),
    modules: {
      get: (userId: number) => get<IEBaselineUserModulesResponse>(`/users/${encodeURIComponent(String(userId))}/modules`),
      update: (userId: number, payload: IEBaselineUpdateUserModulesRequest) =>
        sendJson<IEBaselineUpdateUserModulesResponse, IEBaselineUpdateUserModulesRequest>(
          'PUT',
          `/users/${encodeURIComponent(String(userId))}/modules`,
          payload,
        ),
    },
  },
  modules: {
    list: () => get<IEBaselineModule[]>('/modules'),
    questions: {
      get: (moduleId: number) =>
        get<IEBaselineModuleQuestion[]>(`/modules/${encodeURIComponent(String(moduleId))}/questions`),
    },
    attempts: {
      start: (moduleId: number, userId = IEBASELINE_DEMO_USER_ID) =>
        sendJson<IEBaselineStartAttemptResponse, IEBaselineStartAttemptRequest>(
          'POST',
          `/modules/${encodeURIComponent(String(moduleId))}/attempts/start`,
          { userId },
        ),
      list: async (moduleId: number, userId = IEBASELINE_DEMO_USER_ID) => {
        const data = await get<IEBaselineAttemptHistoryResponse>(
          `/modules/${encodeURIComponent(String(moduleId))}/attempts?user_id=${encodeURIComponent(String(userId))}`,
        );

        return Array.isArray(data) ? data : data.attempts;
      },
    },
  },
  attempts: {
    get: (attemptId: number) =>
      get<IEBaselineAttempt>(`/attempts/${encodeURIComponent(String(attemptId))}`),
    questions: {
      get: (attemptId: number) =>
        get<IEBaselineAttemptQuestionsResponse>(`/attempts/${encodeURIComponent(String(attemptId))}/questions`),
      saveAnswer: (attemptId: number, questionId: number, payload: IEBaselineSaveAnswerRequest) =>
        sendJson<IEBaselineSaveAnswerResponse, IEBaselineSaveAnswerRequest>(
          'PUT',
          `/attempts/${encodeURIComponent(String(attemptId))}/questions/${encodeURIComponent(String(questionId))}/answer`,
          payload,
        ),
      clearAnswer: (attemptId: number, questionId: number) =>
        sendJson<IEBaselineSaveAnswerResponse>(
          'DELETE',
          `/attempts/${encodeURIComponent(String(attemptId))}/questions/${encodeURIComponent(String(questionId))}/answer`,
        ),
    },
    submit: (attemptId: number) =>
      sendJson<IEBaselineSubmitAttemptResponse>(
        'POST',
        `/attempts/${encodeURIComponent(String(attemptId))}/submit`,
      ),
  },
};
