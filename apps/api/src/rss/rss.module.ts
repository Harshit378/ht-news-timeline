import { Module } from '@nestjs/common';
import { RssController } from './rss.controller';
import { RssIngestionService } from './rss-ingestion.service';
import { RssService } from './rss.service';

@Module({
  controllers: [RssController],
  providers: [RssService, RssIngestionService],
  exports: [RssService, RssIngestionService],
})
export class RssModule {}
