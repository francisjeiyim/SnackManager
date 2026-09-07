import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { useRepository } from "../data/RepositoryContext";
import { usePermissions } from "../lib/permissions";
import { cn } from "../lib/cn";

type IconName = "board" | "layout" | "invoices" | "reports" | "products" | "settings";

const Icon = ({ name }: { name: IconName }): JSX.Element => {
  const p: Record<IconName, string> = {
    board: "M4 5h16M4 12h16M4 19h16",
    layout: "M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 13h7v7H4z",
    invoices: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7",
    reports: "M4 20V10M10 20V4M16 20v-7M22 20H2",
    products: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10",
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
    { to: "/settings", key: "nav.settings", icon: "settings", end: false, adminOnly: false },
  ];

export function AppLayout(): JSX.Element {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const repo = useRepository();
  const { isAdmin } = usePermissions();
  const online = repo.mode === "server";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-stone-200/70 bg-white/90 px-3 py-2 backdrop-blur sm:px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            S
          </div>
          <span className="hidden text-sm font-bold text-stone-800 sm:inline">SnackManager</span>
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
                    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent-100 text-accent-700"
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
              "hidden items-center gap-1.5 text-xs sm:inline-flex",
              online ? "text-emerald-600" : "text-stone-400",
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-emerald-500" : "bg-stone-400")}
            />
            {online ? t("app.online") : t("app.offline")}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-600">
              {(user?.displayName ?? user?.username ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <span className="hidden text-xs text-stone-500 lg:inline">{user?.role}</span>
          </div>
          <button
            onClick={() => void logout()}
            className="rounded-lg px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          >
            {t("nav.logout")}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-3 sm:p-4">
        <Outlet />
      </main>
    </div>
  );
}
