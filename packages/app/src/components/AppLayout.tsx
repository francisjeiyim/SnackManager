import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { useRepository } from "../data/RepositoryContext";
import { usePermissions } from "../lib/permissions";
import { useAudioUnlock } from "../lib/useAudioUnlock";
import { cn } from "../lib/cn";

type IconName =
  | "board"
  | "layout"
  | "invoices"
  | "reports"
  | "products"
  | "staff"
  | "settings";

const Icon = ({ name }: { name: IconName }): JSX.Element => {
  const p: Record<IconName, string> = {
    board: "M4 5h16M4 12h16M4 19h16",
    layout: "M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 13h7v7H4z",
    invoices: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7",
    reports: "M4 20V10M10 20V4M16 20v-7M22 20H2",
    products: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10",
    staff: "M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM20 20v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8",
    settings:
      "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 00-1.7-1L14.5 3h-4l-.3 2.5a7 7 0 00-1.7 1l-2.4-1-2 3.5L5 10a7 7 0 000 4l-2 1.5 2 3.5 2.4-1a7 7 0 001.7 1l.3 2.5h4l.3-2.5a7 7 0 001.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d={p[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const links: Array<{ to: string; key: string; icon: IconName; end: boolean; adminOnly: boolean }> =
  [
    { to: "/", key: "nav.board", icon: "board", end: true, adminOnly: false },
    { to: "/rooms", key: "nav.layout", icon: "layout", end: false, adminOnly: true },
    { to: "/invoices", key: "nav.invoices", icon: "invoices", end: false, adminOnly: false },
    { to: "/reports", key: "nav.reports", icon: "reports", end: false, adminOnly: false },
    { to: "/products", key: "nav.products", icon: "products", end: false, adminOnly: false },
    { to: "/staff", key: "nav.staff", icon: "staff", end: false, adminOnly: true },
    { to: "/settings", key: "nav.settings", icon: "settings", end: false, adminOnly: false },
  ];

export function AppLayout(): JSX.Element {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const repo = useRepository();
  const { isAdmin } = usePermissions();
  const online = repo.mode === "server";
  useAudioUnlock();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-stone-200/60 bg-canvas/80 px-3 py-2.5 backdrop-blur-md sm:px-5">
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-sm font-black text-white shadow-sm ring-1 ring-inset ring-white/20">
            S
          </div>
          <span className="hidden text-[15px] font-extrabold tracking-tight text-stone-800 sm:inline">
            Snack<span className="text-accent-600">Manager</span>
          </span>
        </div>

        <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {links
            .filter((l) => !l.adminOnly || isAdmin)
            .map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-all",
                    isActive
                      ? "bg-accent-100 text-accent-700 ring-1 ring-inset ring-accent-200 shadow-sm"
                      : "text-stone-500 hover:bg-stone-100 hover:text-stone-800",
                  )
                }
              >
                <Icon name={l.icon} />
                <span className="hidden md:inline">{t(l.key)}</span>
              </NavLink>
            ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2.5 text-sm">
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium sm:inline-flex",
              online ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-400",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                online ? "bg-emerald-500" : "bg-stone-400",
              )}
            />
            {online ? t("app.online") : t("app.offline")}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-stone-600 ring-1 ring-inset ring-stone-300/60">
              {(user?.displayName ?? user?.username ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <span className="hidden text-xs font-medium text-stone-500 lg:inline">{user?.role}</span>
          </div>
          <button
            onClick={() => void logout()}
            className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
          >
            {t("nav.logout")}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] flex-1 overflow-auto p-3 sm:p-5">
        <Outlet />
      </main>
    </div>
  );
}
