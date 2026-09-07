import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { useRepository } from "../data/RepositoryContext";
import { cn } from "../lib/cn";
import { Button } from "./ui";

const links = [
  { to: "/", key: "nav.board", end: true },
  { to: "/invoices", key: "nav.invoices", end: false },
  { to: "/products", key: "nav.products", end: false },
  { to: "/settings", key: "nav.settings", end: false },
];

export function AppLayout(): JSX.Element {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const repo = useRepository();

  return (
    <div className="flex min-h-full flex-col bg-slate-100">
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2">
        <span className="text-sm font-bold text-slate-800">SnackManager</span>
        <nav className="flex gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
                )
              }
            >
              {t(l.key)}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
            {repo.mode === "server" ? t("app.online") : t("app.offline")}
          </span>
          <span>
            {user?.displayName ?? user?.username} · {user?.role}
          </span>
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            {t("nav.logout")}
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}
