import { io, type Socket } from "socket.io-client";
import { authStore } from "../../lib/authStore";
import type { ServiceListener } from "../repository";

/**
 * Connects to the `/service` namespace and fans every server event out to the
 * registered listeners. Rooms to `join` are supplied lazily (the board knows
 * which `Room.id`s it is showing).
 */
export class ServiceSocket {
  private socket: Socket | null = null;
  private readonly listeners = new Set<ServiceListener>();
  private joined = new Set<string>();

  constructor(private readonly baseUrl: string) {}

  private ensure(): Socket {
    if (this.socket) return this.socket;
    const socket = io(`${this.baseUrl}/service`, {
      // The Cloudflare tunnel in front of prod refuses the WebSocket upgrade
      // (502) and a half-upgraded engine.io session then thrashes. Long-polling
      // alone is rock-solid through the tunnel and still near-instant, so pin
      // the transport and disable the upgrade probe entirely.
      transports: ["polling"],
      upgrade: false,
      auth: () => ({ token: authStore.get().accessToken }),
    });
    socket.onAny((event: string, payload: unknown) => {
      for (const l of this.listeners) l(event, payload);
    });
    socket.on("connect", () => {
      for (const roomId of this.joined) socket.emit("join", roomId);
    });
    this.socket = socket;
    return socket;
  }

  subscribe(listener: ServiceListener): () => void {
    this.listeners.add(listener);
    this.ensure();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.socket?.disconnect();
        this.socket = null;
        this.joined.clear();
      }
    };
  }

  setRooms(roomIds: string[]): void {
    const next = new Set(roomIds);
    const socket = this.socket;
    if (socket) {
      for (const id of next) if (!this.joined.has(id)) socket.emit("join", id);
      for (const id of this.joined) if (!next.has(id)) socket.emit("leave", id);
    }
    this.joined = next;
  }
}
