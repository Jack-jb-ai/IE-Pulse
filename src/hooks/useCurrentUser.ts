import { useEffect, useState } from 'react';

// In prod: nginx reverse-proxies /userinfo/ to AD_GET, so the browser sees a
// same-origin HTTPS call (no mixed content, no CORS). In dev: hit AD_GET
// directly so the browser handles NTLM in the intranet zone — Vite's proxy
// can't forward Windows credentials and would 401.
const USER_INFO_URL = import.meta.env.DEV
  ? 'http://mypenm0iesvr02.corp.jabil.org:5110/User/RetrieveUserInfoNoParam'
  : '/userinfo/RetrieveUserInfoNoParam';

export interface CurrentUser {
  fullName: string | null;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  location: string | null;
  wdId: number | null;
  manager: CurrentUserManager | null;
}

export interface CurrentUserManager {
  name: string | null;
  email: string | null;
  position: string | null;
}

interface ApiUserInfo {
  userName?: string;
  userEmail?: string;
  userNtid?: string;
  department?: string;
  title?: string;
  officeLocation?: string;
  hc?: {
    legalName?: string | null;
    employeeId?: string | number | null;
    businessTitle?: string | null;
    dept?: string | null;
    managerChain?: ApiUserManager[] | null;
  } | null;
}

interface ApiUserManager {
  legalName?: string | null;
  email?: string | null;
  businessTitle?: string | null;
}

let cached: CurrentUser | null = null;
let inflight: Promise<CurrentUser> | null = null;

async function fetchUser(): Promise<CurrentUser> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = fetch(USER_INFO_URL, { credentials: 'include' })
    .then((res) => {
      if (!res.ok) throw new Error(`User info ${res.status}`);
      return res.json();
    })
    .then((data: ApiUserInfo): CurrentUser => {
      const firstManager = data.hc?.managerChain?.[0] ?? null;
      const user: CurrentUser = {
        fullName: data.userName ?? data.hc?.legalName ?? null,
        email: data.userEmail ?? null,
        department: data.department ?? data.hc?.dept ?? null,
        jobTitle: data.title ?? data.hc?.businessTitle ?? null,
        location: data.officeLocation ?? null,
        wdId: parseNumericId(data.userNtid) ?? parseNumericId(data.hc?.employeeId),
        manager: firstManager ? {
          name: firstManager.legalName ?? null,
          email: firstManager.email ?? null,
          position: firstManager.businessTitle ?? null,
        } : null,
      };
      cached = user;
      return user;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

function parseNumericId(value: string | number | null | undefined) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  const trimmed = value?.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Split a name on whitespace AND camel-case boundaries, e.g. "SyedFaizAlhady SyedAhmadAlhady" → ["Syed","Faiz","Alhady","Syed","Ahmad","Alhady"]. */
export function splitNameWords(name: string): string[] {
  return name
    .split(/\s+/)
    .flatMap((token) => token.split(/(?=[A-Z])/))
    .filter(Boolean);
}

/** First N words of the camel-split name, joined with spaces. Defaults to 2 (sidebar style). */
export function shortName(name: string, count = 2): string {
  return splitNameWords(name).slice(0, count).join(' ');
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(cached);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    fetchUser()
      .then((u) => { if (alive) setUser(u); })
      .catch((e) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, []);

  return { user, error };
}
