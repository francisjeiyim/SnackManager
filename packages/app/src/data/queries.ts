import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddItemInput,
  MergeInput,
  PaymentInput,
  ProductInput,
  RoomInput,
  SeatInInput,
  SeatInput,
  SeatPatch,
  SettingsUpdateInput,
  TicketPatchInput,
  UserCreateInput,
} from "@snackmanager/shared";
import { useRepository } from "./RepositoryContext";

export const keys = {
  settings: ["settings"] as const,
  rooms: ["rooms"] as const,
  products: (all: boolean) => ["products", { all }] as const,
  activeGuests: ["guests", "active"] as const,
  liveTickets: ["tickets", "live"] as const,
  ticketHistory: (status?: string) => ["tickets", "history", status ?? "all"] as const,
  ticket: (id: string) => ["tickets", "one", id] as const,
  users: ["users"] as const,
};

export function useSettings() {
  const repo = useRepository();
  return useQuery({ queryKey: keys.settings, queryFn: () => repo.getSettings() });
}

export function useRooms() {
  const repo = useRepository();
  return useQuery({ queryKey: keys.rooms, queryFn: () => repo.listRooms() });
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
  return useQuery({ queryKey: keys.activeGuests, queryFn: () => repo.activeGuests() });
}

export function useLiveTickets() {
  const repo = useRepository();
  return useQuery({
    queryKey: keys.liveTickets,
    queryFn: () => repo.liveTickets(),
    refetchInterval: 20_000,
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

export function useTicket(id: string | null) {
  const repo = useRepository();
  return useQuery({
    queryKey: keys.ticket(id ?? "none"),
    queryFn: () => repo.getTicket(id as string),
    enabled: !!id,
  });
}

export function useUsers() {
  const repo = useRepository();
  return useQuery({ queryKey: keys.users, queryFn: () => repo.listUsers() });
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
    mutationFn: (vars: { id: string; closedAt?: string }) =>
      repo.closeTicket(vars.id, vars.closedAt),
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

export function useSplitTicket(ticketId: string) {
  const repo = useRepository();
  const invalidate = useInvalidateService();
  return useMutation({
    mutationFn: (
      body:
        | { mode: "ITEMIZED"; guestIds: string[]; itemIds: string[] }
        | { mode: "EVEN"; parts: number },
    ) => repo.splitTicket(ticketId, body),
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
