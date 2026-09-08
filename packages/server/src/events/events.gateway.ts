import {
  type OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import { ServiceEvent } from "@snackmanager/shared";

/**
 * Real-time fan-out for the service board. Clients connect to the `/service`
 * namespace and `join` the rooms (by `Room.id`) they are displaying; mutations
 * elsewhere in the app emit here.
 */
@WebSocketGateway({
  namespace: "/service",
  cors: true,
  // Keep long-polling connections alive through buffering proxies / tunnels.
  pingInterval: 15_000,
  pingTimeout: 20_000,
})
export class EventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger("EventsGateway");

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    this.logger.debug(`socket ${client.id} connected`);
  }

  @SubscribeMessage("join")
  onJoin(@ConnectedSocket() client: Socket, @MessageBody() roomId: string): { joined: string } {
    client.join(roomId);
    return { joined: roomId };
  }

  @SubscribeMessage("leave")
  onLeave(@ConnectedSocket() client: Socket, @MessageBody() roomId: string): { left: string } {
    client.leave(roomId);
    return { left: roomId };
  }

  /** Broadcast to one room, or to the whole namespace when `roomId` is null. */
  emitEvent(event: ServiceEvent, payload: unknown, roomId?: string | null): void {
    const target = roomId ? this.server.to(roomId) : this.server;
    target.emit(event, payload);
  }
}
