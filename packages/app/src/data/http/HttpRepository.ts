import type {
  Guest,
  Payment,
  Product,
  PublicUser,
  Room,
  Seat,
  Settings,
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
import { createApiClient, type ApiClient } from "./client";
import { ServiceSocket } from "./socket";
import type {
  PaymentResult,
  RoomWithSeats,
  SeatInResult,
  ServiceListener,
  SnackRepository,
  SplitResult,
  TicketView,
} from "../repository";

const qs = (params: Record<string, string | undefined>): string => {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "");
  return entries.length ? `?${new URLSearchParams(entries as [string, string][]).toString()}` : "";
};

export class HttpRepository implements SnackRepository {
  readonly mode = "server" as const;
  private readonly api: ApiClient;
  readonly socket: ServiceSocket;

  constructor(baseUrl: string) {
    this.api = createApiClient(baseUrl);
    this.socket = new ServiceSocket(baseUrl);
  }

  getSettings(): Promise<Settings> {
    return this.api.request("GET", "/settings");
  }
  updateSettings(patch: SettingsUpdateInput): Promise<Settings> {
    return this.api.request("PUT", "/settings", patch);
  }

  listRooms(): Promise<RoomWithSeats[]> {
    return this.api.request("GET", "/rooms");
  }
  createRoom(input: RoomInput): Promise<Room> {
    return this.api.request("POST", "/rooms", input);
  }
  updateRoom(id: string, patch: Partial<RoomInput>): Promise<Room> {
    return this.api.request("PATCH", `/rooms/${id}`, patch);
  }
  async deleteRoom(id: string): Promise<void> {
    await this.api.request("DELETE", `/rooms/${id}`);
  }

  createSeat(input: SeatInput): Promise<Seat> {
    return this.api.request("POST", "/seats", input);
  }
  updateSeat(id: string, patch: SeatPatch): Promise<Seat> {
    return this.api.request("PATCH", `/seats/${id}`, patch);
  }
  bulkUpdateSeats(roomId: string, seats: Array<{ id: string } & SeatPatch>): Promise<Seat[]> {
    return this.api.request("PATCH", "/seats/bulk", { roomId, seats });
  }
  async deleteSeat(id: string): Promise<void> {
    await this.api.request("DELETE", `/seats/${id}`);
  }

  listProducts(includeInactive = false): Promise<Product[]> {
    return this.api.request("GET", `/products${includeInactive ? "?all=1" : ""}`);
  }
  createProduct(input: ProductInput): Promise<Product> {
    return this.api.request("POST", "/products", input);
  }
  updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product> {
    return this.api.request("PATCH", `/products/${id}`, patch);
  }
  async deleteProduct(id: string): Promise<void> {
    await this.api.request("DELETE", `/products/${id}`);
  }

  activeGuests(): Promise<Guest[]> {
    return this.api.request("GET", "/guests/active");
  }
  seatIn(input: SeatInInput): Promise<SeatInResult> {
    return this.api.request("POST", "/guests/seat-in", input);
  }
  moveGuest(guestId: string, toSeatId: string): Promise<Guest> {
    return this.api.request("PATCH", `/guests/${guestId}/move`, { toSeatId });
  }
  seatOutGuest(guestId: string): Promise<Guest> {
    return this.api.request("POST", `/guests/${guestId}/seat-out`);
  }

  liveTickets(): Promise<TicketView[]> {
    return this.api.request("GET", "/tickets/live");
  }
  listTickets(params: { status?: string; serviceDay?: string } = {}): Promise<TicketView[]> {
    return this.api.request("GET", `/tickets${qs(params)}`);
  }
  getTicket(id: string): Promise<TicketView> {
    return this.api.request("GET", `/tickets/${id}`);
  }
  addItem(ticketId: string, body: Omit<AddItemInput, "ticketId">): Promise<TicketView> {
    return this.api.request("POST", `/tickets/${ticketId}/items`, body);
  }
  voidItem(ticketId: string, itemId: string): Promise<TicketView> {
    return this.api.request("PATCH", `/tickets/${ticketId}/items/${itemId}/void`);
  }
  patchTicket(id: string, body: TicketPatchInput): Promise<TicketView> {
    return this.api.request("PATCH", `/tickets/${id}`, body);
  }
  closeTicket(id: string, closedAt?: string): Promise<TicketView> {
    return this.api.request("POST", `/tickets/${id}/close`, { closedAt });
  }
  mergeTickets(input: MergeInput): Promise<TicketView> {
    return this.api.request("POST", "/tickets/merge", input);
  }
  splitTicket(
    id: string,
    body:
      { mode: "ITEMIZED"; guestIds: string[]; itemIds: string[] } | { mode: "EVEN"; parts: number },
  ): Promise<SplitResult> {
    return this.api.request("POST", `/tickets/${id}/split`, body);
  }
  listPayments(ticketId: string): Promise<Payment[]> {
    return this.api.request("GET", `/tickets/${ticketId}/payments`);
  }
  takePayment(ticketId: string, body: Omit<PaymentInput, "ticketId">): Promise<PaymentResult> {
    return this.api.request("POST", `/tickets/${ticketId}/payments`, body);
  }

  listUsers(): Promise<PublicUser[]> {
    return this.api.request("GET", "/users");
  }
  createUser(input: UserCreateInput): Promise<PublicUser> {
    return this.api.request("POST", "/users", input);
  }
  setUserActive(id: string, isActive: boolean): Promise<PublicUser> {
    return this.api.request("PATCH", `/users/${id}/active`, { isActive });
  }

  subscribe(listener: ServiceListener): () => void {
    return this.socket.subscribe(listener);
  }
  setServiceRooms(roomIds: string[]): void {
    this.socket.setRooms(roomIds);
  }
}
