const BASE = '/ietools/iebaseline/api';

export type IEBaselineHomeStatus = 'Not Started' | 'In Progress' | 'Completed';
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
  progress: number;
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
  email?: string | null;
  department?: string | null;
  role_id?: number | null;
  role_name?: string | null;
  reports_to?: number | null;
  reports_to_name?: string | null;
  assigned_module_count?: number | null;
}

export interface IEBaselineUserProfile {
  user_id: number;
  name: string;
  position: string | null;
  wd_id: number | null;
  email: string | null;
  department: string | null;
  role_id: number;
  role_name?: string | null;
  reports_to: number | null;
  reports_to_name?: string | null;
  assigned_module_count?: number | null;
}

export interface IEBaselineUserPayload {
  name: string;
  position: string | null;
  wd_id: number | null;
  reports_to: number | null;
  email: string | null;
  department: string | null;
  role_id: number | null;
}

export interface IEBaselineUserMutationResponse extends IEBaselineUserProfile {
  created: boolean;
}

export interface IEBaselineRole {
  role_id: number;
  role_name: string;
}

export interface IEBaselineDeleteUserResponse {
  deleted: boolean;
  user_id: number;
}

export interface IEBaselineDeletePreview {
  user_id: number;
  can_delete: boolean;
  blocking_reasons: string[];
  related_counts: Record<string, number>;
}

export interface IEBaselineResolveCurrentUserRequest {
  name: string;
  email: string;
  position: string | null;
  department: string | null;
}

export interface IEBaselineResolveCurrentUserResponse {
  user_id: number;
  name: string;
  position: string | null;
  wd_id: number | null;
  email: string;
  department: string | null;
  role_id: number | null;
  reports_to: number | null;
  created: boolean;
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
  isAttached: boolean;
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
  attachmentRequirement: 'none' | 'optional' | 'required' | string | null;
  attachmentInstruction: string | null;
  attachmentApprovalRequired: boolean | null;
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
  answerId: number;
  selectedAnswer: string | null;
  isAnswered: boolean;
  isAttached: boolean;
  answeredQuestions: number;
  totalQuestions: number;
  progressPercentage: number;
  lastSavedAt: string;
}

export interface IEBaselineSubmitAttemptResponse {
  attempt: IEBaselineAttempt;
  progress: IEBaselineAttemptProgress;
}

export interface IEBaselineValidationQuestion {
  question_id: number;
  question_num?: number | string | null;
  question_no: number | string | null;
}

export interface IEBaselineValidationDetail {
  success: false;
  code: 'UNANSWERED_QUESTIONS' | 'REQUIRED_ATTACHMENTS_MISSING' | string;
  message: string;
  unanswered_questions?: IEBaselineValidationQuestion[];
  missing_questions?: IEBaselineValidationQuestion[];
}

export interface IEBaselineAttachment {
  id: number;
  attachmentUnqId: string;
  moduleId: number;
  answerId: number;
  originalFileName: string;
  mimeType: string | null;
  fileExtension: string | null;
  fileSizeBytes: number | null;
  displayOrder: number;
  uploadedBy: number;
  createdAt: string;
  downloadUrl: string;
}

export interface IEBaselineAttachmentsResponse {
  attachments: IEBaselineAttachment[];
}

export interface IEBaselineUploadAttachmentResponse {
  attachment: IEBaselineAttachment;
}

export interface IEBaselineDeleteAttachmentResponse {
  deleted: boolean;
  attachmentUnqId: string;
}

export type IEBaselineAttemptHistoryItem = IEBaselineAttempt;
type IEBaselineAttemptHistoryResponse = IEBaselineAttemptHistoryItem[] | { attempts: IEBaselineAttemptHistoryItem[] };

export class IEBaselineApiError extends Error {
  status: number;
  detail: unknown;
  validationDetail: IEBaselineValidationDetail | null;

  constructor(path: string, status: number, detail: unknown) {
    const validationDetail = getValidationDetail(detail);
    super(`IE Baseline API ${path} -> ${status}${formatErrorDetail(detail, validationDetail)}`);
    this.name = 'IEBaselineApiError';
    this.status = status;
    this.detail = detail;
    this.validationDetail = validationDetail;
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);

  if (!res.ok) {
    throw new IEBaselineApiError(path, res.status, await readErrorDetail(res));
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
    throw new IEBaselineApiError(path, res.status, await readErrorDetail(res));
  }

  return res.json() as Promise<TResponse>;
}

async function sendForm<TResponse>(method: 'POST', path: string, formData: FormData): Promise<TResponse> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    body: formData,
  });

  if (!res.ok) {
    throw new IEBaselineApiError(path, res.status, await readErrorDetail(res));
  }

  return res.json() as Promise<TResponse>;
}

async function readErrorDetail(res: Response): Promise<unknown> {
  try {
    const body = await res.json();
    return body?.detail ?? body;
  } catch {
    return null;
  }
}

function getValidationDetail(detail: unknown): IEBaselineValidationDetail | null {
  if (!detail || typeof detail !== 'object') return null;
  const value = detail as Partial<IEBaselineValidationDetail>;
  if (value.success === false && typeof value.code === 'string' && typeof value.message === 'string') {
    return value as IEBaselineValidationDetail;
  }
  return null;
}

function formatErrorDetail(detail: unknown, validationDetail: IEBaselineValidationDetail | null) {
  if (validationDetail) return `: ${validationDetail.message}`;
  if (typeof detail === 'string') return `: ${detail}`;
  if (detail && typeof detail === 'object' && typeof (detail as { message?: unknown }).message === 'string') {
    return `: ${(detail as { message: string }).message}`;
  }
  return '';
}

export const ieBaselineApi = {
  home: {
    get: (userId: number) =>
      get<IEBaselineHomeResponse>(`/home?user_id=${encodeURIComponent(String(userId))}`),
  },
  users: {
    list: () => get<IEBaselineUser[]>('/users'),
    search: (query?: string, options?: { limit?: number; excludeUserId?: number | null }) => {
      const params = new URLSearchParams();
      const trimmed = query?.trim();
      if (trimmed) params.set('q', trimmed);
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.excludeUserId) params.set('exclude_user_id', String(options.excludeUserId));
      const qs = params.toString();
      return get<IEBaselineUserProfile[]>(`/users/search${qs ? `?${qs}` : ''}`);
    },
    get: (userId: number) =>
      get<IEBaselineUserProfile>(`/users/${encodeURIComponent(String(userId))}`),
    create: (payload: IEBaselineUserPayload) =>
      sendJson<IEBaselineUserMutationResponse, IEBaselineUserPayload>(
        'POST',
        '/users/create',
        payload,
      ),
    update: (userId: number, payload: IEBaselineUserPayload) =>
      sendJson<IEBaselineUserMutationResponse, IEBaselineUserPayload>(
        'PUT',
        `/users/${encodeURIComponent(String(userId))}`,
        payload,
      ),
    remove: (userId: number) =>
      sendJson<IEBaselineDeleteUserResponse>(
        'DELETE',
        `/users/${encodeURIComponent(String(userId))}`,
      ),
    deletePreview: (userId: number) =>
      get<IEBaselineDeletePreview>(`/users/${encodeURIComponent(String(userId))}/delete-preview`),
    resolveCurrent: (payload: IEBaselineResolveCurrentUserRequest) =>
      sendJson<IEBaselineResolveCurrentUserResponse, IEBaselineResolveCurrentUserRequest>(
        'POST',
        '/users/resolve-current',
        payload,
      ),
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
  roles: {
    list: () => get<IEBaselineRole[]>('/roles'),
  },
  modules: {
    list: () => get<IEBaselineModule[]>('/modules'),
    questions: {
      get: (moduleId: number) =>
        get<IEBaselineModuleQuestion[]>(`/modules/${encodeURIComponent(String(moduleId))}/questions`),
    },
    attempts: {
      start: (moduleId: number, userId: number) =>
        sendJson<IEBaselineStartAttemptResponse, IEBaselineStartAttemptRequest>(
          'POST',
          `/modules/${encodeURIComponent(String(moduleId))}/attempts/start`,
          { userId },
        ),
      list: async (moduleId: number, userId: number) => {
        const data = await get<IEBaselineAttemptHistoryResponse>(
          `/modules/${encodeURIComponent(String(moduleId))}/attempts?user_id=${encodeURIComponent(String(userId))}`,
        );

        return Array.isArray(data) ? data : data.attempts;
      },
    },
    attachments: {
      list: (moduleId: number, answerId: number, userId: number) =>
        get<IEBaselineAttachmentsResponse>(
          `/modules/${encodeURIComponent(String(moduleId))}/attachments?user_id=${encodeURIComponent(String(userId))}&answer_id=${encodeURIComponent(String(answerId))}`,
        ),
      upload: (moduleId: number, answerId: number, file: File, userId: number) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploadedBy', String(userId));
        formData.append('answerId', String(answerId));
        formData.append('displayOrder', '0');

        return sendForm<IEBaselineUploadAttachmentResponse>(
          'POST',
          `/modules/${encodeURIComponent(String(moduleId))}/attachments`,
          formData,
        );
      },
      remove: (moduleId: number, attachmentUnqId: string, userId: number) =>
        sendJson<IEBaselineDeleteAttachmentResponse>(
          'DELETE',
          `/modules/${encodeURIComponent(String(moduleId))}/attachments/${encodeURIComponent(attachmentUnqId)}?user_id=${encodeURIComponent(String(userId))}`,
        ),
      downloadUrl: (attachmentUnqId: string, userId: number) =>
        `${BASE}/attachments/${encodeURIComponent(attachmentUnqId)}/download?user_id=${encodeURIComponent(String(userId))}`,
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
