import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddItemInput,
  ExtensionKind,
  MergeInput,
  PaymentInput,
  ProductInput,
  RoomInput,
  SeatInInput,
  SeatInput,
  SeatPatch,
  SettingsUpdateInput,
  StaffPresence,
  TicketPatchInput,
  UserCreateInput,
  UserUpdateInput,
} from "@snackmanager/shared";
import { useRepository } from "./RepositoryContext";
import type { SplitBody } from "./repository";

/**
 * Poll interval for state that other connected clients change. The socket makes
 * these updates instant when it can connect; this is the reliable floor when it
 * can't (e.g. a proxy that refuses the transport).
 */
const LIVE_MS = 4000;

export const keys = {
  settings: ["settings"] as const,
  rooms: ["rooms"] as const,
  products: (all: boolean) => ["products", { all }] as const,
  activeGuests: ["guests", "active"] as const,
  liveTickets: ["tickets", "live"] as const,
  unpaidTickets: ["tickets", "unpaid"] as const,
  ticketHistory: (status?: string) => ["tickets", "history", status ?? "all"] as const,
  ticket: (id: string) => ["tickets", "one", id] as const,
  users: ["users"] as const,
};

export function useSettings() {
  const repo = useRepository();
  return useQuery({
    queryKey: keys.settings,
    queryFn: () => repo.getSettings(),
    refetchInterval: LIVE_MS,
  });
}

export function useRooms() {
  const repo = useRepository();
  return useQuery({
    queryKey: keys.rooms,
    queryFn: () => repo.listRooms(),
    refetchInterval: LIVE_MS,
  });
}

export function useProducts(includeInactive = false) {
  const repo = useRepository();
  return useQuery({
    queryKey: keys.products(includeInactive),
    queryFn: () => repo.listProducts(includeInactive),
  });
}

export function useActiveGuests() {
  const repo = useRepository();
  return useQuery({
    queryKey: keys.activeGuests,
    queryFn: () => repo.activeGuests(),
    refetchInterval: LIVE_MS,
  });
}

export function useLiveTickets() {
  const repo = useRepository();
  return useQuery({
    queryKey: keys.liveTickets,
    queryFn: () => repo.liveTickets(),
    refetchInterval: LIVE_MS,
  });
}

export function useUnpaidTickets() {
  const repo = useRepository();
  return useQuery({
    queryKey: keys.unpaidTickets,
    queryFn: () => repo.unpaidTickets(),
    refetchInterval: LIVE_MS,
  });
}

export function useTicketHistory(status?: string) {
  const repo = useRepository();
  return useQuery({
    queryKey: keys.ticketHistory(status),
    queryFn: () => repo.listTickets({ status }),
  });
}

export function useTicketsByDay(serviceDay: string) {
  const repo = useRepository();
  return useQuery({
    queryKey: ["tickets", "day", serviceDay],
    queryFn: () => repo.listTickets({ serviceDay }),
    enabled: !!serviceDay,
  });
}

export function useTicketsRange(from: string, to: string) {
  const repo = useRepository();
  return useQuery({
    queryKey: ["tickets", "range", from, to],
    queryFn: () => repo.listTickets({ from, to }),
    enabled: !!from && !!to,
  });
}

export function useTicket(id: string | null) {
  const repo = useRepository();
  return useQuery({
    queryKey: keys.ticket(id ?? "none"),
    queryFn: () => repo.getTicket(id as string),
    enabled: !!id,
    refetchInterval: LIVE_MS,
  });
}

export function useUsers() {
  const repo = useRepository();
  return useQuery({
    queryKey: keys.users,
    queryFn: () => repo.listUsers(),
    refetchInterval: LIVE_MS,
  });
}

/** Present, active staff — the pick list for assigning a guest. */
export function useAssignableStaff() {
  const repo = useRepository();
  return useQuery({
    queryKey: ["users", "assignable"],
    queryFn: () => repo.assignableStaff(),
    refetchInterval: LIVE_MS,
  });
}

/** Invalidate the queries touched by any ticket/guest mutation. */
function useInvalidateService() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["tickets"] });
    void qc.invalidateQueries({ queryKey: ["guests"] });
  };
}

export function useSeatIn() {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (input: SeatInInput) => repo.seatIn(input),
    onSuccess: invalidate,
  });
}

export function useAddItem(ticketId: string) {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (body: Omit<AddItemInput, "ticketId">) => repo.addItem(ticketId, body),
    onSuccess: invalidate,
  });
}

export function useVoidItem(ticketId: string) {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (itemId: string) => repo.voidItem(ticketId, itemId),
    onSuccess: invalidate,
  });
}

export function usePatchTicket(ticketId: string) {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (body: TicketPatchInput) => repo.patchTicket(ticketId, body),
    onSuccess: invalidate,
  });
}

export function useCloseTicket() {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      closedAt?: string;
      overdueExtension?: "SET" | "HALF" | "NONE";
    }) =>
      repo.closeTicket(vars.id, {
        closedAt: vars.closedAt,
        overdueExtension: vars.overdueExtension,
      }),
    onSuccess: invalidate,
  });
}

export function useExtendGuest() {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (vars: { guestId: string; kind: ExtensionKind }) =>
      repo.extendGuest(vars.guestId, vars.kind),
    onSuccess: invalidate,
  });
}

export function useUndoExtension() {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (vars: { guestId: string }) => repo.undoLastExtension(vars.guestId),
    onSuccess: invalidate,
  });
}

export function useMergeTickets() {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (input: MergeInput) => repo.mergeTickets(input),
    onSuccess: invalidate,
  });
}

export function useWriteOffTicket() {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (vars: { id: string }) => repo.writeOffTicket(vars.id),
    onSuccess: invalidate,
  });
}

export function useSplitTicket(ticketId: string) {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (body: SplitBody) => repo.splitTicket(ticketId, body),
    onSuccess: invalidate,
  });
}

export function useMoveGuest() {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (vars: { guestId: string; toSeatId: string }) =>
      repo.moveGuest(vars.guestId, vars.toSeatId),
    onSuccess: invalidate,
  });
}

export function useRenameGuest() {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (vars: { guestId: string; displayName: string | null }) =>
      repo.renameGuest(vars.guestId, vars.displayName),
    onSuccess: invalidate,
  });
}

export function useTakePayment(ticketId: string) {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (body: Omit<PaymentInput, "ticketId">) => repo.takePayment(ticketId, body),
    onSuccess: invalidate,
  });
}

export function useSeatOutGuest() {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (guestId: string) => repo.seatOutGuest(guestId),
    onSuccess: invalidate,
  });
}

export function useSaveSettings() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsUpdateInput) => repo.updateSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.settings }),
  });
}

export function useResetOperationalData() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { password: string }) => repo.resetOperationalData(vars.password),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useProductMutations() {
  const repo = useRepository();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["products"] });
  return {
    create: useMutation({
      mutationFn: (input: ProductInput) => repo.createProduct(input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (vars: { id: string; patch: Partial<ProductInput> }) =>
        repo.updateProduct(vars.id, vars.patch),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => repo.deleteProduct(id),
      onSuccess: invalidate,
    }),
  };
}

export function useCreateUser() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UserCreateInput) => repo.createUser(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.users }),
  });
}

/** Edit / presence / password / delete for one staff account. */
export function useStaffMutations() {
  const repo = useRepository();
  const qc = useQueryClient();
  const invalidate = (): Promise<void> => qc.invalidateQueries({ queryKey: keys.users });
  return {
    update: useMutation({
      mutationFn: (v: { id: string; patch: UserUpdateInput }) => repo.updateUser(v.id, v.patch),
      onSuccess: invalidate,
    }),
    setPresence: useMutation({
      mutationFn: (v: { id: string; presence: StaffPresence }) =>
        repo.setUserPresence(v.id, v.presence),
      onSuccess: invalidate,
    }),
    resetPassword: useMutation({
      mutationFn: (v: { id: string; password: string }) =>
        repo.resetUserPassword(v.id, v.password),
    }),
    remove: useMutation({
      mutationFn: (id: string) => repo.deleteUser(id),
      onSuccess: invalidate,
    }),
  };
}

/** Assign / release the staff member in charge of a guest. */
export function useAssignGuest() {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (v: { guestId: string; userId: string }) => repo.assignGuest(v.guestId, v.userId),
    onSuccess: invalidate,
  });
}

export function useUnassignGuest() {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (guestId: string) => repo.unassignGuest(guestId),
    onSuccess: invalidate,
  });
}

/** Room + seat CRUD for the layout editor. */
export function useLayoutMutations() {
  const repo = useRepository();
  const qc = useQueryClient();
  const invalidate = (): Promise<void> => qc.invalidateQueries({ queryKey: keys.rooms });
  return {
    createRoom: useMutation({
      mutationFn: (input: RoomInput) => repo.createRoom(input),
      onSuccess: invalidate,
    }),
    updateRoom: useMutation({
      mutationFn: (vars: { id: string; patch: Partial<RoomInput> }) =>
        repo.updateRoom(vars.id, vars.patch),
      onSuccess: invalidate,
    }),
    deleteRoom: useMutation({
      mutationFn: (id: string) => repo.deleteRoom(id),
      onSuccess: invalidate,
    }),
    createSeat: useMutation({
      mutationFn: (input: SeatInput) => repo.createSeat(input),
      onSuccess: invalidate,
    }),
    bulkUpdateSeats: useMutation({
      mutationFn: (vars: { roomId: string; seats: Array<{ id: string } & SeatPatch> }) =>
        repo.bulkUpdateSeats(vars.roomId, vars.seats),
      onSuccess: invalidate,
    }),
    deleteSeat: useMutation({
      mutationFn: (id: string) => repo.deleteSeat(id),
      onSuccess: invalidate,
    }),
  };
}

/** Shared, temporary floor positions on the board (not the saved layout). */
export function useArrangeMutations() {
  const repo = useRepository();
  const qc = useQueryClient();
  const invalidate = (): Promise<void> => qc.invalidateQueries({ queryKey: keys.rooms });
  return {
    arrange: useMutation({
      mutationFn: (vars: { roomId: string; seats: Array<{ id: string; x: number; y: number }> }) =>
        repo.arrangeSeats(vars.roomId, vars.seats),
      onSuccess: invalidate,
    }),
    reset: useMutation({
      mutationFn: (roomId: string) => repo.resetArrangement(roomId),
      onSuccess: invalidate,
    }),
  };
}
