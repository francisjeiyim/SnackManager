import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TimeRounding } from "@snackmanager/shared";
import { Button, Card, Field, Input, Select, Spinner } from "../../components/ui";
import { loadLocalConfig, saveLocalConfig, type DeployMode } from "../../lib/config";
import { setLocale, storedLocale } from "../../i18n";
import { useAuth } from "../../auth/AuthContext";
import { useSaveSettings, useSettings } from "../../data/queries";
import { getLocalDb, importLocalDb, resetLocalDb } from "../../data/local/db";

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
    hourWarningIntervalMinutes: 60,
    hourWarningMinutes: 10,
  });
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (settingsQ.data) {
      setForm({
        defaultRatePerMinuteYen: settingsQ.data.defaultRatePerMinuteYen,
        graceMinutes: settingsQ.data.graceMinutes,
        minChargeMinutes: settingsQ.data.minChargeMinutes,
        timeRounding: settingsQ.data.timeRounding,
        hourWarningIntervalMinutes: settingsQ.data.hourWarningIntervalMinutes,
        hourWarningMinutes: settingsQ.data.hourWarningMinutes,
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
          <p className="text-xs text-slate-500">{t("settings.autonomousHint")}</p>
        ) : (
          <Field label={t("settings.apiUrl")}>
            <Input value={local.apiUrl} onChange={(e) => applyLocal({ apiUrl: e.target.value })} />
          </Field>
        )}
        <Field label={t("settings.locale")}>
          <Select
            defaultValue={storedLocale()}
            onChange={(e) => setLocale(e.target.value as "ja" | "en")}
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <p className="text-xs text-slate-400">{t("settings.reloadHint")}</p>
      </Card>

      {local.mode === "autonomous" ? <LocalDataCard /> : null}

      <Card className="space-y-4 p-4">
        <h2 className="text-sm font-semibold text-slate-700">{t("settings.billing")}</h2>
        {settingsQ.isLoading ? (
          <Spinner />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <Field label={t("settings.alertInterval")} hint={t("settings.alertIntervalHint")}>
                <Input
                  type="number"
                  min={0}
                  max={600}
                  disabled={!isAdmin}
                  value={form.hourWarningIntervalMinutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      hourWarningIntervalMinutes: Math.min(
                        600,
                        Math.max(0, Number(e.target.value) || 0),
                      ),
                    })
                  }
                />
              </Field>
              <Field label={t("settings.alertLead")} hint={t("settings.alertLeadHint")}>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  disabled={!isAdmin}
                  value={form.hourWarningMinutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      hourWarningMinutes: Math.min(120, Math.max(0, Number(e.target.value) || 0)),
                    })
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

      {isAdmin ? (
        <Card className="flex items-center justify-between p-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-700">{t("settings.staff")}</h2>
            <p className="text-xs text-stone-400">{t("staff.title")}</p>
          </div>
          <Link to="/staff">
            <Button size="sm" variant="secondary">
              {t("settings.manageStaff")}
            </Button>
          </Link>
        </Card>
      ) : null}
    </div>
  );
}

function LocalDataCard(): JSX.Element {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<"opfs" | "kvvfs" | "memory" | null>(null);

  useEffect(() => {
    void getLocalDb().then((db) => setKind(db.kind));
  }, []);

  const exportDb = async (): Promise<void> => {
    setBusy(true);
    try {
      const db = await getLocalDb();
      const bytes = db.exportBytes();
      const buffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const blob = new Blob([buffer], { type: "application/x-sqlite3" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `snackmanager-${new Date().toISOString().slice(0, 10)}.sqlite3`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const importDb = async (file: File): Promise<void> => {
    setBusy(true);
    try {
      await importLocalDb(new Uint8Array(await file.arrayBuffer()));
    } catch (err) {
      setBusy(false);
      window.alert(String(err));
    }
  };

  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-semibold text-slate-700">{t("settings.localData")}</h2>
      {kind === "memory" ? (
        <p className="text-xs text-amber-600">{t("settings.notPersistent")}</p>
      ) : kind === "kvvfs" ? (
        <p className="text-xs text-slate-500">{t("settings.kvvfsNote")}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void exportDb()}>
          {t("settings.exportDb")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || kind !== "opfs"}
          onClick={() => fileRef.current?.click()}
        >
          {t("settings.importDb")}
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("settings.resetDbConfirm"))) void resetLocalDb();
          }}
        >
          {t("settings.resetDb")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".sqlite3,.db,application/x-sqlite3"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importDb(f);
          }}
        />
      </div>
      <p className="text-xs text-slate-400">{t("settings.localDataHint")}</p>
    </Card>
  );
}
