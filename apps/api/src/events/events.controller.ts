import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { NewsStore } from '../store/news.store';
import { EventsGateway } from './events.gateway';

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
  async createUpdate(
    @Body() body: { eventId: string; message: string; importance?: string },
  ) {
    const result = await this.store.addEventUpdate(
      body.eventId,
      body.message,
      body.importance ?? 'normal',
    );
    if (!result) throw new NotFoundException();
    this.gateway.broadcast({
      eventId: body.eventId,
      update: result.update,
      status: result.event.status,
    });
    return result;
  }
}
