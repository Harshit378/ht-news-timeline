import { describe, expect, it, vi } from 'vitest';
import { InMemoryEventBus, LIVE_CHANNEL, RedisEventBus, createEventBus, type RedisLike } from './event-bus';

/** In-process stand-in for one Redis server: every connection subscribed to a channel gets each publish. */
class FakeRedisServer {
  readonly subscribers = new Set<FakeRedis>();
  connect() {
    return new FakeRedis(this);
  }
}

class FakeRedis implements RedisLike {
  status = 'ready';
  private listeners: ((channel: string, message: string) => void)[] = [];
  private channels = new Set<string>();
  constructor(private readonly server: FakeRedisServer) {}
  async publish(channel: string, message: string) {
    if (this.status !== 'ready') throw new Error('Connection is closed.');
    let n = 0;
    for (const s of this.server.subscribers) {
      if (s.channels.has(channel)) {
        n++;
        queueMicrotask(() => s.listeners.forEach((l) => l(channel, message)));
      }
    }
    return n;
  }
  async subscribe(channel: string) {
    this.channels.add(channel);
    this.server.subscribers.add(this);
    return 1;
  }
  on(_event: 'message', listener: (channel: string, message: string) => void) {
    this.listeners.push(listener);
    return this;
  }
  async quit() {
    this.status = 'end';
    this.server.subscribers.delete(this);
    return 'OK';
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('RedisEventBus', () => {
  it('delivers an update published on one instance to subscribers on every instance, once each', async () => {
    const server = new FakeRedisServer();
    const a = new RedisEventBus(server.connect(), server.connect());
    const b = new RedisEventBus(server.connect(), server.connect());
    const gotA = vi.fn();
    const gotB = vi.fn();
    a.subscribe(gotA);
    b.subscribe(gotB);
    await tick();

    await a.publish({ eventId: 'e1', update: { id: 'u1' } });
    await tick();

    expect(gotA).toHaveBeenCalledTimes(1);
    expect(gotB).toHaveBeenCalledTimes(1);
    expect(gotB).toHaveBeenCalledWith({ eventId: 'e1', update: { id: 'u1' } });
  });

  it('falls back to local delivery when Redis is down', async () => {
    const server = new FakeRedisServer();
    const pub = server.connect();
    const bus = new RedisEventBus(pub, server.connect());
    const got = vi.fn();
    bus.subscribe(got);
    pub.status = 'reconnecting';
    await bus.publish({ eventId: 'e1' });
    expect(got).toHaveBeenCalledWith({ eventId: 'e1' });
  });

  it('falls back to local delivery when a publish throws', async () => {
    const server = new FakeRedisServer();
    const pub = server.connect();
    pub.publish = vi.fn(async () => {
      throw new Error('boom');
    });
    const bus = new RedisEventBus(pub, server.connect());
    const got = vi.fn();
    bus.subscribe(got);
    await bus.publish({ eventId: 'e1' });
    expect(got).toHaveBeenCalledTimes(1);
  });

  it('ignores other channels and malformed messages', async () => {
    const server = new FakeRedisServer();
    const other = server.connect();
    const bus = new RedisEventBus(server.connect(), server.connect());
    const got = vi.fn();
    bus.subscribe(got);
    await tick();
    await other.publish('other-channel', '{"x":1}');
    await other.publish(LIVE_CHANNEL, 'not json');
    await tick();
    expect(got).not.toHaveBeenCalled();
  });
});

describe('createEventBus', () => {
  it('is in-memory without REDIS_URL', async () => {
    const bus = createEventBus({});
    expect(bus).toBeInstanceOf(InMemoryEventBus);
    const got = vi.fn();
    bus.subscribe(got);
    await bus.publish('hi');
    expect(got).toHaveBeenCalledWith('hi');
  });
});
