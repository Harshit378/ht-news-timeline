import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Carries live-event updates to every API instance (ADR-005). Each instance's gateway only knows its own
 * sockets, so a POST handled by instance A must reach clients connected to instance B.
 */
export interface EventBus {
  publish(message: unknown): Promise<void>;
  subscribe(handler: (message: unknown) => void): void;
  close(): Promise<void>;
}

export const EVENT_BUS = Symbol('EVENT_BUS');

/** Single instance: deliver straight to the local subscribers. */
export class InMemoryEventBus implements EventBus {
  private readonly handlers: ((message: unknown) => void)[] = [];

  async publish(message: unknown) {
    for (const handler of this.handlers) handler(message);
  }

  subscribe(handler: (message: unknown) => void) {
    this.handlers.push(handler);
  }

  async close() {
    this.handlers.length = 0;
  }
}

/** The subset of ioredis used here, so tests can pass a fake. */
export interface RedisLike {
  status: string;
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string): Promise<unknown>;
  on(event: 'message', listener: (channel: string, message: string) => void): unknown;
  quit(): Promise<unknown>;
}

export const LIVE_CHANNEL = 'ht:live-events';

/**
 * Redis pub/sub fan-out. Every instance (including the publisher) receives the message from Redis, so
 * nothing is delivered twice. If Redis is unreachable the update is delivered locally only, with a warning,
 * rather than lost.
 */
export class RedisEventBus implements EventBus {
  private readonly logger = new Logger(RedisEventBus.name);
  private readonly local = new InMemoryEventBus();

  constructor(
    private readonly pub: RedisLike,
    private readonly sub: RedisLike,
    private readonly channel = LIVE_CHANNEL,
  ) {
    this.sub.on('message', (ch, raw) => {
      if (ch !== this.channel) return;
      try {
        void this.local.publish(JSON.parse(raw));
      } catch {
        this.logger.warn('dropped a malformed live-event message');
      }
    });
    this.sub.subscribe(this.channel).catch((err: unknown) => {
      this.logger.warn(`redis subscribe failed: ${err instanceof Error ? err.message : err}`);
    });
  }

  async publish(message: unknown) {
    if (this.pub.status === 'ready') {
      try {
        await this.pub.publish(this.channel, JSON.stringify(message));
        return;
      } catch (err) {
        this.logger.warn(`redis publish failed, delivering locally only: ${err instanceof Error ? err.message : err}`);
      }
    } else {
      this.logger.warn(`redis ${this.pub.status}, delivering locally only`);
    }
    await this.local.publish(message);
  }

  subscribe(handler: (message: unknown) => void) {
    this.local.subscribe(handler);
  }

  async close() {
    await Promise.allSettled([this.pub.quit(), this.sub.quit()]);
    await this.local.close();
  }
}

/** REDIS_URL set → Redis fan-out (needed with more than one API instance); otherwise in-memory. */
export function createEventBus(env: NodeJS.ProcessEnv = process.env): EventBus {
  const url = env.REDIS_URL;
  if (!url) return new InMemoryEventBus();
  // Publisher fails fast (falls back to local delivery); the subscriber queues and re-subscribes on reconnect.
  const pub = new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: false });
  const sub = new Redis(url, { autoResubscribe: true });
  return new RedisEventBus(pub, sub);
}
