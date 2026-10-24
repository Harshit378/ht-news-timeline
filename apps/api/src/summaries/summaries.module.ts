import { Module } from '@nestjs/common';
import { StoryBriefService } from './story-brief.service';
import { SummariesController } from './summaries.controller';
import { SummariesService } from './summaries.service';
import { SummaryGenerator } from './summary-generator.service';

@Module({
  controllers: [SummariesController],
  providers: [SummariesService, SummaryGenerator, StoryBriefService],
  exports: [SummariesService, StoryBriefService],
})
export class SummariesModule {}
