import type { UserRole } from "@snackmanager/shared";

const REFRESH_KEY = "sm.refresh";

export interface SessionUser {
  id: string;
  username: string;
  role: UserRole;
  displayName?: string | null;
}

interface AuthState {
  user: SessionUser | null;
  accessToken: string | null;
}

let state: AuthState = { user: null, accessToken: null };
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export const authStore = {
  get(): AuthState {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  setSession(user: SessionUser, accessToken: string, refreshToken?: string): void {
    state = { user, accessToken };
    if (refreshToken) {
      try {
        localStorage.setItem(REFRESH_KEY, refreshToken);
      } catch {
        /* ignore */
      }
    }
    emit();
  },
  setAccessToken(accessToken: string): void {
    state = { ...state, accessToken };
    emit();
  },
  clear(): void {
    state = { user: null, accessToken: null };
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
    emit();
  },
  refreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
};
