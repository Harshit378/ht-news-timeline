import { Inject, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBus, createEventBus } from './event-bus';
import { EventsController } from './events.controller';
import { EventsGateway } from './events.gateway';

/** Delivers bus messages (from this or any other instance) to this instance's sockets. */
@Injectable()
export class EventsFanout implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    private readonly gateway: EventsGateway,
  ) {}

  onModuleInit() {
    this.bus.subscribe((message) => this.gateway.broadcast(message));
  }

  onModuleDestroy() {
    return this.bus.close();
  }
}

@Module({
  controllers: [EventsController],
  providers: [EventsGateway, EventsFanout, { provide: EVENT_BUS, useFactory: () => createEventBus() }],
  exports: [EventsGateway],
})
export class EventsModule {}
