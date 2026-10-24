import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { NewsStore } from '../store/news.store';
import { EventsGateway } from './events.gateway';

const IMPORTANCE = new Set(['critical', 'high', 'normal', 'low']);
const MAX_MESSAGE = 1000;

/**
 * Posting an update broadcasts to every connected reader, so it needs `Authorization: Bearer
 * $EVENTS_ADMIN_TOKEN`. Without a configured token the route is open in development and closed in production.
 */
export function assertCanPost(authorization: string | undefined, env: NodeJS.ProcessEnv = process.env) {
  const token = env.EVENTS_ADMIN_TOKEN;
  if (!token) {
    if (env.NODE_ENV === 'production') throw new ForbiddenException('live event posting is not configured');
    return;
  }
  const given = Buffer.from(authorization?.replace(/^Bearer\s+/i, '') ?? '');
  const expected = Buffer.from(token);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new UnauthorizedException();
  }
}

export function parseUpdateBody(body: unknown): { eventId: string; message: string; importance: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const eventId = typeof b.eventId === 'string' ? b.eventId.trim() : '';
  const message = typeof b.message === 'string' ? b.message.trim() : '';
  const importance = b.importance === undefined ? 'normal' : b.importance;
  if (!eventId) throw new BadRequestException('eventId is required');
  if (!message || message.length > MAX_MESSAGE) {
    throw new BadRequestException(`message must be 1–${MAX_MESSAGE} characters`);
  }
  if (typeof importance !== 'string' || !IMPORTANCE.has(importance)) {
    throw new BadRequestException('importance must be critical, high, normal or low');
  }
  return { eventId, message, importance };
}

@Controller('events')
export class EventsController {
  constructor(
    private readonly store: NewsStore,
    private readonly gateway: EventsGateway,
  ) {}

  @Get()
  list() {
    return this.store.listEvents();
  }

  @Get(':id')
  one(@Param('id') id: string) {
    const event = this.store.getEvent(id);
    if (!event) throw new NotFoundException();
    return event;
  }

  @Post()
  async createUpdate(@Body() body: unknown, @Headers('authorization') authorization?: string) {
    assertCanPost(authorization);
    const { eventId, message, importance } = parseUpdateBody(body);
    const result = await this.store.addEventUpdate(eventId, message, importance);
    if (!result) throw new NotFoundException();
    this.gateway.broadcast({
      eventId,
      update: result.update,
      status: result.event.status,
    });
    return result;
  }
}
