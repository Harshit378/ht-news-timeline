import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventsModule } from '../events/events.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RestModule } from '../rest/rest.module';
import { RssModule } from '../rss/rss.module';
import { SummariesModule } from '../summaries/summaries.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    BillingModule,
    LlmModule,
    RestModule,
    EventsModule,
    SummariesModule,
    RssModule,
    IngestionModule,
  ],
})
export class AppModule {}
