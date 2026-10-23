import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import type { IncomingMessage } from 'http';
import type { RawData, WebSocket } from 'ws';

@WebSocketGateway({ path: '/ws/events' })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);
  private readonly clients = new Set<WebSocket>();

  handleConnection(client: WebSocket, _req: IncomingMessage) {
    this.clients.add(client);
    client.send(
      JSON.stringify({
        type: 'ping',
        data: { clients: this.clients.size },
        timestamp: new Date().toISOString(),
      }),
    );
    client.on('message', (raw: RawData) => {
      this.logger.debug(`ws message ${String(raw).slice(0, 120)}`);
    });
  }

  handleDisconnect(client: WebSocket) {
    this.clients.delete(client);
  }

  broadcast(payload: unknown) {
    const message = JSON.stringify({
      type: 'update',
      data: payload,
      timestamp: new Date().toISOString(),
    });
    for (const client of this.clients) {
      if (client.readyState === 1) client.send(message);
    }
  }
}
