import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RssController } from './rss.controller';
import { RssIngestionService } from './rss-ingestion.service';
import { RssService } from './rss.service';

@Module({
  imports: [AuthModule],
  controllers: [RssController],
  providers: [RssService, RssIngestionService],
  exports: [RssService, RssIngestionService],
})
export class RssModule {}
