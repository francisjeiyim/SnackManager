import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./AuthContext";
import { Button, Field, Input } from "../components/ui";
import { unlockAudio } from "../lib/chime";

export function LoginPage(): JSX.Element {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    void unlockAudio(); // this click is our chance to permit alert sounds
    try {
      await login(username.trim(), password);
    } catch {
      setError(t("login.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden p-4">
      {/* soft decorative glow */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-accent-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl" />

      <div className="relative w-full max-w-sm rounded-3xl border border-stone-200/70 bg-white/90 p-7 shadow-panel backdrop-blur-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-xl font-black text-white shadow-sm ring-1 ring-inset ring-white/20">
            S
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-stone-800">
            Snack<span className="text-accent-600">Manager</span>
          </h1>
          <p className="mt-1 text-sm text-stone-500">{t("login.title")}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label={t("login.username")}>
            <Input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </Field>
          <Field label={t("login.password")}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          {error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={busy}
            disabled={busy || !username || !password}
          >
            {t("login.submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
