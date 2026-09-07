import type {
  Guest,
  Payment,
  Product,
  PublicUser,
  Room,
  Seat,
  Settings,
  Ticket,
  TicketItem,
  TicketTotals,
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

export interface RoomWithSeats extends Room {
  seats: Seat[];
}

/** What the server returns for a ticket: the row + its graph + live totals. */
export interface TicketView extends Ticket {
  guests: Guest[];
  items: TicketItem[];
  payments: Payment[];
  live: TicketTotals;
}

export interface SeatInResult {
  partyId: string;
  tickets: TicketView[];
}

export interface EvenSplitResult {
  mode: "EVEN";
  ticketId: string;
  parts: number;
  shares: number[];
  total: number;
}

export interface ItemizedSplitResult {
  mode: "ITEMIZED";
  originTicket: TicketView;
  newTicket: TicketView;
}

export type SplitResult = EvenSplitResult | ItemizedSplitResult;

export interface PaymentResult {
  ticketId: string;
  totalYen: number;
  paidYen: number;
  balanceYen: number;
  status: string;
}

export type ServiceListener = (event: string, payload: unknown) => void;

/**
 * The single seam between the UI and its data source. `HttpRepository` talks to
 * the NestJS API; `SqliteRepository` (Phase 5) runs entirely in the browser.
 */
export interface SnackRepository {
  readonly mode: "server" | "autonomous";

  getSettings(): Promise<Settings>;
  updateSettings(patch: SettingsUpdateInput): Promise<Settings>;

  listRooms(): Promise<RoomWithSeats[]>;
  createRoom(input: RoomInput): Promise<Room>;
  updateRoom(id: string, patch: Partial<RoomInput>): Promise<Room>;
  deleteRoom(id: string): Promise<void>;

  createSeat(input: SeatInput): Promise<Seat>;
  updateSeat(id: string, patch: SeatPatch): Promise<Seat>;
  bulkUpdateSeats(roomId: string, seats: Array<{ id: string } & SeatPatch>): Promise<Seat[]>;
  deleteSeat(id: string): Promise<void>;

  listProducts(includeInactive?: boolean): Promise<Product[]>;
  createProduct(input: ProductInput): Promise<Product>;
  updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;

  activeGuests(): Promise<Guest[]>;
  seatIn(input: SeatInInput): Promise<SeatInResult>;
  moveGuest(guestId: string, toSeatId: string): Promise<Guest>;
  seatOutGuest(guestId: string): Promise<Guest>;

  liveTickets(): Promise<TicketView[]>;
  listTickets(params?: { status?: string; serviceDay?: string }): Promise<TicketView[]>;
  getTicket(id: string): Promise<TicketView>;
  addItem(ticketId: string, body: Omit<AddItemInput, "ticketId">): Promise<TicketView>;
  voidItem(ticketId: string, itemId: string): Promise<TicketView>;
  patchTicket(id: string, body: TicketPatchInput): Promise<TicketView>;
  closeTicket(id: string, closedAt?: string): Promise<TicketView>;
  mergeTickets(input: MergeInput): Promise<TicketView>;
  splitTicket(
    id: string,
    body:
      { mode: "ITEMIZED"; guestIds: string[]; itemIds: string[] } | { mode: "EVEN"; parts: number },
  ): Promise<SplitResult>;
  listPayments(ticketId: string): Promise<Payment[]>;
  takePayment(ticketId: string, body: Omit<PaymentInput, "ticketId">): Promise<PaymentResult>;

  listUsers(): Promise<PublicUser[]>;
  createUser(input: UserCreateInput): Promise<PublicUser>;
  setUserActive(id: string, isActive: boolean): Promise<PublicUser>;

  /** Real-time change feed. Returns an unsubscribe function. */
  subscribe(listener: ServiceListener): () => void;

  /** Tell the transport which rooms are on screen (server mode: socket joins). */
  setServiceRooms?(roomIds: string[]): void;
}
