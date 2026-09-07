import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadLocalConfig } from "../lib/config";
import { authStore, type SessionUser } from "../lib/authStore";
import { setOnSessionLost } from "../data/http/client";

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const { apiUrl } = loadLocalConfig();
  const [user, setUser] = useState<SessionUser | null>(authStore.get().user);
  const [loading, setLoading] = useState(true);

  useEffect(() => authStore.subscribe(() => setUser(authStore.get().user)), []);

  useEffect(() => {
    setOnSessionLost(() => authStore.clear());
    let cancelled = false;
    void (async () => {
      const rt = authStore.refreshToken();
      if (rt) {
        try {
          const res = await fetch(`${apiUrl}/api/auth/refresh`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ refreshToken: rt }),
          });
          if (res.ok) {
            const data = (await res.json()) as { accessToken: string; refreshToken: string };
            const me = (await fetch(`${apiUrl}/api/auth/me`, {
              headers: { authorization: `Bearer ${data.accessToken}` },
            }).then((r) => r.json())) as SessionUser;
            if (!cancelled) authStore.setSession(me, data.accessToken, data.refreshToken);
          } else {
            authStore.clear();
          }
        } catch {
          authStore.clear();
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const login = async (username: string, password: string): Promise<void> => {
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("login failed");
    const data = (await res.json()) as {
      user: SessionUser;
      accessToken: string;
      refreshToken: string;
    };
    authStore.setSession(data.user, data.accessToken, data.refreshToken);
  };

  const logout = async (): Promise<void> => {
    const rt = authStore.refreshToken();
    authStore.clear();
    if (rt) {
      void fetch(`${apiUrl}/api/auth/logout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      }).catch(() => undefined);
    }
  };

  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
