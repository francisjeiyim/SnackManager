import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PublicUser, StaffPresence, UserRole } from "@snackmanager/shared";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  Skeleton,
} from "../../components/ui";
import { cn } from "../../lib/cn";
import { dateTime } from "../../lib/format";
import { storedLocale } from "../../i18n";
import { useAuth } from "../../auth/AuthContext";
import { useCreateUser, useStaffMutations, useUsers } from "../../data/queries";

const ROLES: UserRole[] = ["ADMIN", "CASHIER", "SERVER"];
const PRESENCES: StaffPresence[] = ["PRESENT", "BREAK", "ABSENT"];

export function StaffPage(): JSX.Element {
  const { t } = useTranslation();
  const locale = storedLocale();
  const { user: me } = useAuth();
  const usersQ = useUsers();
  const createUser = useCreateUser();
  const { update, setPresence, resetPassword, remove } = useStaffMutations();

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [pwFor, setPwFor] = useState<PublicUser | null>(null);

  const users = usersQ.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-stone-800">{t("staff.title")}</h1>
        <Button size="sm" onClick={() => setAdding(true)}>
          {t("staff.add")}
        </Button>
      </div>

      <Card>
        {usersQ.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon="☺" title={t("staff.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-stone-200 text-left text-xs uppercase text-stone-400">
                <tr>
                  <th className="p-3">{t("staff.name")}</th>
                  <th className="p-3">{t("staff.job")}</th>
                  <th className="p-3">{t("staff.role")}</th>
                  <th className="p-3">{t("staff.presence")}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className={cn(
                      "border-b border-stone-100 last:border-0",
                      !u.isActive && "opacity-50",
                    )}
                  >
                    <td className="p-3">
                      <div className="font-medium text-stone-800">
                        {u.displayName ?? u.username}
                      </div>
                      <div className="text-xs text-stone-400">@{u.username}</div>
                    </td>
                    <td className="p-3 text-stone-500">{u.jobTitle ?? "—"}</td>
                    <td className="p-3">
                      <Badge tone={u.role === "ADMIN" ? "accent" : "stone"}>
                        {t(`staff.roles.${u.role}`)}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="inline-flex overflow-hidden rounded-lg border border-stone-200">
                        {PRESENCES.map((p) => (
                          <button
                            key={p}
                            onClick={() => setPresence.mutate({ id: u.id, presence: p })}
                            disabled={setPresence.isPending}
                            className={cn(
                              "px-2 py-1 text-xs font-medium transition-colors",
                              u.presence === p
                                ? p === "PRESENT"
                                  ? "bg-emerald-500 text-white"
                                  : p === "BREAK"
                                    ? "bg-amber-500 text-white"
                                    : "bg-stone-400 text-white"
                                : "bg-white text-stone-500 hover:bg-stone-50",
                            )}
                          >
                            {t(`staff.${p.toLowerCase()}`)}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <IconButton label={t("staff.edit")} onClick={() => setEditing(u)}>
                          ✎
                        </IconButton>
                        <IconButton
                          label={t("staff.resetPassword")}
                          onClick={() => setPwFor(u)}
                        >
                          🔑
                        </IconButton>
                        <IconButton
                          label={t("staff.delete")}
                          onClick={() => {
                            if (u.id === me?.id) {
                              window.alert(t("staff.selfForbidden"));
                              return;
                            }
                            if (window.confirm(t("staff.deleteConfirm", { name: u.username }))) {
                              remove.mutate(u.id);
                            }
                          }}
                        >
                          🗑
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {users.some((u) => u.presenceChangedAt) ? (
        <p className="px-1 text-xs text-stone-400">
          {users
            .filter((u) => u.presence !== "ABSENT" && u.presenceChangedAt)
            .map(
              (u) =>
                `${u.displayName ?? u.username}: ${t(`staff.${u.presence.toLowerCase()}`)} ` +
                t("staff.since", { time: dateTime(u.presenceChangedAt!, locale) }),
            )
            .join(" · ")}
        </p>
      ) : null}

      {adding ? (
        <AddStaffModal
          pending={createUser.isPending}
          onClose={() => setAdding(false)}
          onSave={(v) => createUser.mutate(v, { onSuccess: () => setAdding(false) })}
        />
      ) : null}

      {editing ? (
        <EditStaffModal
          user={editing}
          pending={update.isPending}
          onClose={() => setEditing(null)}
          onSave={(patch) =>
            update.mutate(
              { id: editing.id, patch },
              { onSuccess: () => setEditing(null) },
            )
          }
        />
      ) : null}

      {pwFor ? (
        <PasswordModal
          name={pwFor.displayName ?? pwFor.username}
          pending={resetPassword.isPending}
          onClose={() => setPwFor(null)}
          onSave={(password) =>
            resetPassword.mutate(
              { id: pwFor.id, password },
              { onSuccess: () => setPwFor(null) },
            )
          }
        />
      ) : null}
    </div>
  );
}

interface AddDraft {
  username: string;
  displayName: string;
  jobTitle: string;
  password: string;
  role: UserRole;
}

function AddStaffModal({
  pending,
  onClose,
  onSave,
}: {
  pending: boolean;
  onClose: () => void;
  onSave: (v: {
    username: string;
    password: string;
    displayName: string | null;
    jobTitle: string | null;
    role: UserRole;
  }) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [d, setD] = useState<AddDraft>({
    username: "",
    displayName: "",
    jobTitle: "",
    password: "",
    role: "SERVER",
  });
  const valid = d.username.trim().length > 0 && d.password.length >= 8;

  return (
    <Modal
      open
      onClose={onClose}
      title={t("staff.add")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!valid || pending}
            onClick={() =>
              onSave({
                username: d.username.trim(),
                password: d.password,
                displayName: d.displayName.trim() || null,
                jobTitle: d.jobTitle.trim() || null,
                role: d.role,
              })
            }
          >
            {t("staff.add")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("staff.username")}>
          <Input value={d.username} onChange={(e) => setD({ ...d, username: e.target.value })} />
        </Field>
        <Field label={t("staff.name")}>
          <Input
            value={d.displayName}
            onChange={(e) => setD({ ...d, displayName: e.target.value })}
          />
        </Field>
        <Field label={t("staff.job")}>
          <Input
            value={d.jobTitle}
            placeholder={t("staff.jobPlaceholder")}
            onChange={(e) => setD({ ...d, jobTitle: e.target.value })}
          />
        </Field>
        <Field label={t("staff.role")}>
          <Select value={d.role} onChange={(e) => setD({ ...d, role: e.target.value as UserRole })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`staff.roles.${r}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("staff.password")} hint="min. 8">
          <Input
            type="password"
            value={d.password}
            onChange={(e) => setD({ ...d, password: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}

function EditStaffModal({
  user,
  pending,
  onClose,
  onSave,
}: {
  user: PublicUser;
  pending: boolean;
  onClose: () => void;
  onSave: (patch: {
    displayName: string | null;
    jobTitle: string | null;
    role: UserRole;
    isActive: boolean;
  }) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? "");
  const [role, setRole] = useState<UserRole>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t("staff.edit")} — @${user.username}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              onSave({
                displayName: displayName.trim() || null,
                jobTitle: jobTitle.trim() || null,
                role,
                isActive,
              })
            }
          >
            {t("settings.save")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("staff.name")}>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label={t("staff.job")}>
          <Input
            value={jobTitle}
            placeholder={t("staff.jobPlaceholder")}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </Field>
        <Field label={t("staff.role")}>
          <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`staff.roles.${r}`)}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-stone-600 sm:mt-6">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          {t("staff.active")}
        </label>
      </div>
    </Modal>
  );
}

function PasswordModal({
  name,
  pending,
  onClose,
  onSave,
}: {
  name: string;
  pending: boolean;
  onClose: () => void;
  onSave: (password: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [pw, setPw] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title={`${t("staff.resetPassword")} — ${name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={pw.length < 8 || pending} onClick={() => onSave(pw)}>
            {t("staff.resetPassword")}
          </Button>
        </>
      }
    >
      <Field label={t("staff.newPassword")} hint="min. 8">
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}
