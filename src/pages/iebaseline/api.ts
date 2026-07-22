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

async function sendJson<TResponse, TBody>(method: 'PUT' | 'POST' | 'DELETE', path: string, body: TBody): Promise<TResponse> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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
  },
};
