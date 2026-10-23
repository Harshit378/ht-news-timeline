import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventsModule } from '../events/events.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RestModule } from '../rest/rest.module';
import { RssModule } from '../rss/rss.module';
import { SummariesModule } from '../summaries/summaries.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    RestModule,
    EventsModule,
    SummariesModule,
    RssModule,
    IngestionModule,
  ],
})
export class AppModule {}
