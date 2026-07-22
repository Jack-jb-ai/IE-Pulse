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

export const ieBaselineApi = {
  home: {
    get: (userId = IEBASELINE_DEMO_USER_ID) =>
      get<IEBaselineHomeResponse>(`/home?user_id=${encodeURIComponent(String(userId))}`),
  },
};
