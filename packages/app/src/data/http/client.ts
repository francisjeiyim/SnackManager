import { authStore } from "../../lib/authStore";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClient {
  request<T>(method: string, path: string, body?: unknown): Promise<T>;
  baseUrl: string;
}

let onSessionLost: (() => void) | null = null;
export function setOnSessionLost(fn: () => void): void {
  onSessionLost = fn;
}

/**
 * "ok"        — a new access token is in place, retry the request.
 * "expired"   — the refresh token is genuinely dead, sign the user out.
 * "transient" — network / 5xx hiccup (Cloudflare tunnel 502…); keep the
 *               session, let the caller fail this round and retry later.
 */
type RefreshOutcome = "ok" | "expired" | "transient";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Rotate the refresh token exactly once, even under a burst of parallel 401s. */
export function createTokenRefresher(baseUrl: string): () => Promise<RefreshOutcome> {
  let inflight: Promise<RefreshOutcome> | null = null;

  async function doRefresh(): Promise<RefreshOutcome> {
    const refreshToken = authStore.refreshToken();
    if (!refreshToken) return "expired";

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (res.ok) {
          const data = (await res.json()) as { accessToken: string; refreshToken: string };
          authStore.setAccessToken(data.accessToken);
          try {
            localStorage.setItem("sm.refresh", data.refreshToken);
          } catch {
            /* ignore */
          }
          return "ok";
        }
        if (res.status === 401 || res.status === 403 || res.status === 400) return "expired";
        // 5xx — retry once, then give up transiently
        if (attempt === 0) await sleep(400);
      } catch {
        if (attempt === 0) await sleep(400);
      }
    }
    return "transient";
  }

  return function refresh(): Promise<RefreshOutcome> {
    if (!inflight) {
      inflight = doRefresh().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  };
}

export function createApiClient(baseUrl: string): ApiClient {
  const refresh = createTokenRefresher(baseUrl);

  async function once(method: string, path: string, body?: unknown): Promise<Response> {
    const token = authStore.get().accessToken;
    return fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  return {
    baseUrl,
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      let res = await once(method, path, body);

      if (res.status === 401) {
        const outcome = await refresh();
        if (outcome === "ok") {
          res = await once(method, path, body);
        } else if (outcome === "transient") {
          // Don't touch the session — the query layer will retry shortly.
          throw new ApiError(503, "auth refresh temporarily unavailable");
        } else {
          authStore.clear();
          onSessionLost?.();
          throw new ApiError(401, "session expired");
        }
      }

      const text = await res.text();
      const parsed = text ? (JSON.parse(text) as unknown) : undefined;
      if (!res.ok) {
        // A 401 that survived a successful refresh means the account really lost access.
        if (res.status === 401) {
          authStore.clear();
          onSessionLost?.();
        }
        const message =
          (parsed as { message?: string; error?: string })?.message ??
          (parsed as { error?: string })?.error ??
          `HTTP ${res.status}`;
        throw new ApiError(res.status, message, parsed);
      }
      return parsed as T;
    },
  };
}
