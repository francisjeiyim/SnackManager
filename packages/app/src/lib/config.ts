export type DeployMode = "server" | "autonomous";

export interface LocalConfig {
  mode: DeployMode;
  apiUrl: string;
}

const KEY = "sm.config";

const envApiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4100";
const envMode = ((import.meta.env.VITE_DEFAULT_MODE as string | undefined) ??
  "server") as DeployMode;

export function loadLocalConfig(): LocalConfig {
  const base: LocalConfig = { mode: envMode, apiUrl: envApiUrl };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...base, ...(JSON.parse(raw) as Partial<LocalConfig>) };
  } catch {
    /* private mode / disabled storage — fall through to defaults */
  }
  return base;
}

export function saveLocalConfig(patch: Partial<LocalConfig>): LocalConfig {
  const next = { ...loadLocalConfig(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
