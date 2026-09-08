import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { loadLocalConfig } from "../lib/config";
import { HttpRepository } from "./http/HttpRepository";
import { SqliteRepository } from "./local/SqliteRepository";
import type { SnackRepository } from "./repository";

const RepositoryCtx = createContext<SnackRepository | null>(null);

export function RepositoryProvider({ children }: { children: ReactNode }): JSX.Element {
  const cfg = loadLocalConfig();
  const repo = useMemo<SnackRepository>(
    () => (cfg.mode === "autonomous" ? new SqliteRepository() : new HttpRepository(cfg.apiUrl)),
    [cfg.apiUrl, cfg.mode],
  );
  const qc = useQueryClient();

  useEffect(() => {
    return repo.subscribe((event) => {
      if (event.startsWith("ticket.") || event.startsWith("guest.")) {
        void qc.invalidateQueries({ queryKey: ["tickets"] });
        void qc.invalidateQueries({ queryKey: ["guests"] });
      }
      if (event.startsWith("seat.") || event.startsWith("layout.") || event.startsWith("room.")) {
        void qc.invalidateQueries({ queryKey: ["rooms"] });
        void qc.invalidateQueries({ queryKey: ["guests"] });
      }
      if (event.startsWith("product.")) {
        void qc.invalidateQueries({ queryKey: ["products"] });
      }
      if (event.startsWith("settings.")) {
        void qc.invalidateQueries({ queryKey: ["settings"] });
        // open tickets recompute against the new rate / rounding / windows
        void qc.invalidateQueries({ queryKey: ["tickets"] });
        void qc.invalidateQueries({ queryKey: ["guests"] });
      }
      if (event.startsWith("user.")) {
        void qc.invalidateQueries({ queryKey: ["users"] });
      }
      if (event.startsWith("assignment.")) {
        void qc.invalidateQueries({ queryKey: ["guests"] });
      }
    });
  }, [repo, qc]);

  return <RepositoryCtx.Provider value={repo}>{children}</RepositoryCtx.Provider>;
}

export function useRepository(): SnackRepository {
  const repo = useContext(RepositoryCtx);
  if (!repo) throw new Error("useRepository must be used within <RepositoryProvider>");
  return repo;
}
