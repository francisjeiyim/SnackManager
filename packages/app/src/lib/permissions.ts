import type { UserRole } from "@snackmanager/shared";
import { useAuth } from "../auth/AuthContext";

export interface Permissions {
  role: UserRole | undefined;
  isAdmin: boolean;
  /** Seat guests, take orders, add/remove items on open tickets. */
  canServe: boolean;
  /** Close / merge / split / void tickets and take payments. */
  canCashier: boolean;
}

export function usePermissions(): Permissions {
  const role = useAuth().user?.role;
  const isAdmin = role === "ADMIN";
  return {
    role,
    isAdmin,
    canServe: isAdmin || role === "CASHIER" || role === "SERVER",
    canCashier: isAdmin || role === "CASHIER",
  };
}
