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

async function tryRefresh(baseUrl: string): Promise<boolean> {
  const refreshToken = authStore.refreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    authStore.setAccessToken(data.accessToken);
    try {
      localStorage.setItem("sm.refresh", data.refreshToken);
    } catch {
      /* ignore */
    }
    return true;
  } catch {
    return false;
  }
}

export function createApiClient(baseUrl: string): ApiClient {
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
      if (res.status === 401 && (await tryRefresh(baseUrl))) {
        res = await once(method, path, body);
      }
      const text = await res.text();
      const parsed = text ? (JSON.parse(text) as unknown) : undefined;
      if (!res.ok) {
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
