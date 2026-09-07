import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./AuthContext";
import { Button, Card, Field, Input } from "../components/ui";

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
    try {
      await login(username.trim(), password);
    } catch {
      setError(t("login.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">SnackManager</h1>
        <p className="mb-5 text-sm text-slate-500">{t("login.title")}</p>
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
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy || !username || !password}>
            {t("login.submit")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
