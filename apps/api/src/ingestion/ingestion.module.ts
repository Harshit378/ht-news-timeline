import { Module } from '@nestjs/common';
import { SummariesModule } from '../summaries/summaries.module';
import { GdeltBigQueryService } from './gdelt-bigquery.service';
import { GdeltDocService } from './gdelt-doc.service';
import { IngestionScheduler } from './ingestion.scheduler';

@Module({
  imports: [SummariesModule],
  providers: [GdeltDocService, GdeltBigQueryService, IngestionScheduler],
  exports: [GdeltDocService],
})
export class IngestionModule {}
