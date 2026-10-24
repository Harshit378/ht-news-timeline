import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'net';
import { WebSocket, WebSocketServer } from 'ws';
import { EventsGateway, POLICY_VIOLATION } from './events.gateway';
import { EventsController, assertCanPost, parseUpdateBody } from './events.controller';
import { InMemoryEventBus } from './event-bus';

/** Real ws server whose connections go through the gateway, as WsAdapter does. */
async function serve(gateway: EventsGateway) {
  const wss = new WebSocketServer({ port: 0 });
  wss.on('connection', (ws, req) => {
    gateway.handleConnection(ws, req);
    ws.on('close', () => gateway.handleDisconnect(ws));
  });
  await new Promise<void>((resolve) => wss.once('listening', () => resolve()));
  const url = `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`;
  return { wss, url };
}

/** Opens a client and collects its messages; `nextMessage()` resolves with the next one. */
function connect(url: string, origin?: string) {
  const ws = new WebSocket(url, origin ? { origin } : undefined);
  const queue: string[] = [];
  const waiters: ((m: string) => void)[] = [];
  ws.on('message', (data) => {
    const text = String(data);
    const waiter = waiters.shift();
    if (waiter) waiter(text);
    else queue.push(text);
  });
  const nextMessage = () =>
    new Promise<string>((resolve) => {
      const queued = queue.shift();
      if (queued !== undefined) resolve(queued);
      else waiters.push(resolve);
    });
  return { ws, nextMessage };
}

let cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup) fn();
  cleanup = [];
});

describe('EventsGateway', () => {
  it('pushes broadcasts from POST /api/events to connected clients', async () => {
    const gateway = new EventsGateway();
    const { wss, url } = await serve(gateway);
    cleanup.push(() => wss.close());
    const client = connect(url, 'http://localhost:4200');
    cleanup.push(() => client.ws.close());
    expect(JSON.parse(await client.nextMessage()).type).toBe('ping');

    const update = { id: 'u1', eventId: 'e1', timestamp: new Date(), message: 'Polls closed', importance: 'high', sources: [] };
    const store = {
      addEventUpdate: vi.fn(async () => ({ event: { id: 'e1', status: 'ongoing' }, update })),
    };
    const bus = new InMemoryEventBus();
    bus.subscribe((m) => gateway.broadcast(m));
    const controller = new EventsController(store as never, bus);
    await controller.createUpdate({ eventId: 'e1', message: 'Polls closed', importance: 'high' });

    const msg = JSON.parse(await client.nextMessage());
    expect(msg.type).toBe('update');
    expect(msg.data).toMatchObject({ eventId: 'e1', status: 'ongoing', update: { id: 'u1', message: 'Polls closed' } });
  });

  it('closes connections from a disallowed browser origin', async () => {
    const gateway = new EventsGateway();
    const { wss, url } = await serve(gateway);
    cleanup.push(() => wss.close());
    const { ws } = connect(url, 'https://evil.example.com');
    const code = await new Promise<number>((resolve) => ws.on('close', (c) => resolve(c)));
    expect(code).toBe(POLICY_VIOLATION);
    expect(gateway.size).toBe(0);
  });

  it('drops clients that miss a heartbeat', () => {
    const gateway = new EventsGateway();
    const client = { on: vi.fn(), send: vi.fn(), ping: vi.fn(), terminate: vi.fn(), close: vi.fn() };
    gateway.handleConnection(client as never);
    gateway.sweep(); // alive → pinged, now awaiting pong
    expect(client.ping).toHaveBeenCalledTimes(1);
    gateway.sweep(); // no pong arrived
    expect(client.terminate).toHaveBeenCalled();
    expect(gateway.size).toBe(0);
  });

  it('keeps clients that answer with a pong', () => {
    const gateway = new EventsGateway();
    const handlers: Record<string, () => void> = {};
    const client = {
      on: (event: string, fn: () => void) => (handlers[event] = fn),
      send: vi.fn(),
      ping: vi.fn(() => handlers.pong?.()),
      terminate: vi.fn(),
    };
    gateway.handleConnection(client as never);
    gateway.sweep();
    gateway.sweep();
    expect(client.terminate).not.toHaveBeenCalled();
    expect(gateway.size).toBe(1);
  });
});

describe('assertCanPost', () => {
  it('requires the bearer token when one is configured', () => {
    const env = { EVENTS_ADMIN_TOKEN: 's3cret', NODE_ENV: 'development' };
    expect(() => assertCanPost(undefined, env)).toThrow();
    expect(() => assertCanPost('Bearer wrong', env)).toThrow();
    expect(() => assertCanPost('Bearer s3cret', env)).not.toThrow();
  });

  it('is open in development and closed in production when no token is set', () => {
    expect(() => assertCanPost(undefined, { NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertCanPost('Bearer anything', { NODE_ENV: 'production' })).toThrow();
  });
});

describe('parseUpdateBody', () => {
  it('defaults importance and trims the message', () => {
    expect(parseUpdateBody({ eventId: 'e1', message: '  Polls closed ' })).toEqual({
      eventId: 'e1',
      message: 'Polls closed',
      importance: 'normal',
    });
  });

  it('rejects missing, oversized or badly typed fields', () => {
    expect(() => parseUpdateBody({ message: 'x' })).toThrow();
    expect(() => parseUpdateBody({ eventId: 'e1', message: '' })).toThrow();
    expect(() => parseUpdateBody({ eventId: 'e1', message: 'x'.repeat(1001) })).toThrow();
    expect(() => parseUpdateBody({ eventId: 'e1', message: 'x', importance: 'urgent' })).toThrow();
    expect(() => parseUpdateBody(null)).toThrow();
  });
});
