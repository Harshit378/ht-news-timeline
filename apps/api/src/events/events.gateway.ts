import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import type { IncomingMessage } from 'http';
import type { RawData, WebSocket } from 'ws';
import { isAllowedOrigin } from '../cors';

/** Clients that miss one heartbeat round (no pong) are dropped — mobile networks leave half-open sockets. */
export const HEARTBEAT_MS = 30_000;

/** Close code for a rejected Origin (RFC 6455 "policy violation"). */
export const POLICY_VIOLATION = 1008;

/**
 * Live event updates (ADR-005). Single instance: clients live in memory, so running more than one API
 * instance needs sticky sessions or a Redis pub/sub fan-out in `broadcast`.
 */
@WebSocketGateway({ path: '/ws/events' })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsGateway.name);
  private readonly clients = new Set<WebSocket>();
  private readonly alive = new WeakMap<WebSocket, boolean>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  onModuleInit() {
    this.heartbeat = setInterval(() => this.sweep(), HEARTBEAT_MS);
    this.heartbeat.unref?.();
  }

  onModuleDestroy() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  get size() {
    return this.clients.size;
  }

  handleConnection(client: WebSocket, req?: IncomingMessage) {
    // Browsers always send Origin; native clients and curl don't, and aren't a CSRF-style risk.
    const origin = req?.headers?.origin;
    if (origin && !isAllowedOrigin(origin)) {
      this.logger.warn(`ws rejected origin ${origin}`);
      client.close(POLICY_VIOLATION, 'origin not allowed');
      return;
    }
    this.clients.add(client);
    this.alive.set(client, true);
    client.on('pong', () => this.alive.set(client, true));
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

  /** One heartbeat round: drop clients that didn't answer the previous ping, ping the rest. */
  sweep() {
    for (const client of this.clients) {
      if (!this.alive.get(client)) {
        this.clients.delete(client);
        client.terminate();
        continue;
      }
      this.alive.set(client, false);
      client.ping();
    }
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
