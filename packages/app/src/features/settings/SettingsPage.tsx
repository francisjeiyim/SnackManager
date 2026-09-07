import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TimeRounding, UserRole } from "@snackmanager/shared";
import { Badge, Button, Card, Field, Input, Select, Spinner } from "../../components/ui";
import { loadLocalConfig, saveLocalConfig, type DeployMode } from "../../lib/config";
import { setLocale, storedLocale } from "../../i18n";
import { useAuth } from "../../auth/AuthContext";
import { useCreateUser, useSaveSettings, useSettings, useUsers } from "../../data/queries";

export function SettingsPage(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const settingsQ = useSettings();
  const save = useSaveSettings();

  const [local, setLocal] = useState(loadLocalConfig());
  const [form, setForm] = useState({
    defaultRatePerMinuteYen: 10,
    graceMinutes: 0,
    minChargeMinutes: 0,
    timeRounding: "CEIL_MINUTE" as TimeRounding,
  });
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (settingsQ.data) {
      setForm({
        defaultRatePerMinuteYen: settingsQ.data.defaultRatePerMinuteYen,
        graceMinutes: settingsQ.data.graceMinutes,
        minChargeMinutes: settingsQ.data.minChargeMinutes,
        timeRounding: settingsQ.data.timeRounding,
      });
    }
  }, [settingsQ.data]);

  const applyLocal = (patch: Partial<ReturnType<typeof loadLocalConfig>>): void => {
    setLocal(saveLocalConfig(patch));
  };

  const submit = (): void => {
    save.mutate(form, {
      onSuccess: () => {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
      },
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-800">{t("settings.title")}</h1>

      <Card className="space-y-4 p-4">
        <h2 className="text-sm font-semibold text-slate-700">{t("settings.deployment")}</h2>
        <Field label={t("settings.deployment")}>
          <Select
            value={local.mode}
            onChange={(e) => applyLocal({ mode: e.target.value as DeployMode })}
          >
            <option value="server">{t("settings.modeServer")}</option>
            <option value="autonomous">{t("settings.modeAutonomous")}</option>
          </Select>
        </Field>
        {local.mode === "autonomous" ? (
          <p className="text-xs text-amber-600">{t("settings.autonomousSoon")}</p>
        ) : null}
        <Field label={t("settings.apiUrl")}>
          <Input value={local.apiUrl} onChange={(e) => applyLocal({ apiUrl: e.target.value })} />
        </Field>
        <Field label={t("settings.locale")}>
          <Select
            defaultValue={storedLocale()}
            onChange={(e) => setLocale(e.target.value as "ja" | "en")}
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <p className="text-xs text-slate-400">
          {t("settings.apiUrl")} / {t("settings.deployment")} → reload to apply.
        </p>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="text-sm font-semibold text-slate-700">{t("settings.billing")}</h2>
        {settingsQ.isLoading ? (
          <Spinner />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("settings.ratePerMinute")}>
                <Input
                  type="number"
                  disabled={!isAdmin}
                  value={form.defaultRatePerMinuteYen}
                  onChange={(e) =>
                    setForm({ ...form, defaultRatePerMinuteYen: Number(e.target.value) || 0 })
                  }
                />
              </Field>
              <Field label={t("settings.rounding")}>
                <Select
                  disabled={!isAdmin}
                  value={form.timeRounding}
                  onChange={(e) =>
                    setForm({ ...form, timeRounding: e.target.value as TimeRounding })
                  }
                >
                  <option value="NONE">{t("settings.roundingNone")}</option>
                  <option value="CEIL_MINUTE">{t("settings.roundingCeilMinute")}</option>
                  <option value="CEIL_5MIN">{t("settings.roundingCeil5Min")}</option>
                </Select>
              </Field>
              <Field label={t("settings.graceMinutes")}>
                <Input
                  type="number"
                  disabled={!isAdmin}
                  value={form.graceMinutes}
                  onChange={(e) => setForm({ ...form, graceMinutes: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label={t("settings.minChargeMinutes")}>
                <Input
                  type="number"
                  disabled={!isAdmin}
                  value={form.minChargeMinutes}
                  onChange={(e) =>
                    setForm({ ...form, minChargeMinutes: Number(e.target.value) || 0 })
                  }
                />
              </Field>
            </div>
            {isAdmin ? (
              <div className="flex items-center gap-3">
                <Button disabled={save.isPending} onClick={submit}>
                  {t("settings.save")}
                </Button>
                {savedFlash ? (
                  <span className="text-sm text-emerald-600">{t("settings.saved")}</span>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </Card>

      {isAdmin ? <StaffCard /> : null}
    </div>
  );
}

function StaffCard(): JSX.Element {
  const { t } = useTranslation();
  const usersQ = useUsers();
  const createUser = useCreateUser();
  const [draft, setDraft] = useState({ username: "", password: "", role: "SERVER" as UserRole });

  const add = (): void => {
    createUser.mutate(
      { username: draft.username.trim(), password: draft.password, role: draft.role },
      { onSuccess: () => setDraft({ username: "", password: "", role: "SERVER" }) },
    );
  };

  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-semibold text-slate-700">{t("settings.staff")}</h2>
      {usersQ.isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {(usersQ.data ?? []).map((u) => (
            <li key={u.id} className="flex items-center justify-between py-2">
              <span>
                {u.displayName ?? u.username} <span className="text-slate-400">@{u.username}</span>
              </span>
              <Badge tone={u.isActive ? "emerald" : "slate"}>{t(`settings.roles.${u.role}`)}</Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-[1fr_1fr_120px_auto] items-end gap-2">
        <Field label={t("login.username")}>
          <Input
            value={draft.username}
            onChange={(e) => setDraft({ ...draft, username: e.target.value })}
          />
        </Field>
        <Field label={t("login.password")}>
          <Input
            type="password"
            value={draft.password}
            onChange={(e) => setDraft({ ...draft, password: e.target.value })}
          />
        </Field>
        <Field label={t("settings.role")}>
          <Select
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })}
          >
            <option value="ADMIN">{t("settings.roles.ADMIN")}</option>
            <option value="CASHIER">{t("settings.roles.CASHIER")}</option>
            <option value="SERVER">{t("settings.roles.SERVER")}</option>
          </Select>
        </Field>
        <Button
          size="sm"
          disabled={!draft.username.trim() || draft.password.length < 8 || createUser.isPending}
          onClick={add}
        >
          {t("settings.addStaff")}
        </Button>
      </div>
      {createUser.isError ? (
        <p className="text-sm text-rose-600">{(createUser.error as Error).message}</p>
      ) : null}
    </Card>
  );
}
