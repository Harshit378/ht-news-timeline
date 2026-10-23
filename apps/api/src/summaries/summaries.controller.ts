import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SummariesService } from './summaries.service';

@Controller('summaries')
export class SummariesController {
  constructor(private readonly summaries: SummariesService) {}

  @Get()
  list() {
    return this.summaries.list();
  }

  @Get(':topicName')
  get(@Param('topicName') topicName: string) {
    return this.summaries.get(topicName);
  }

  @Post('generate')
  generate(@Body() body: { topicName?: string }) {
    if (body?.topicName) return this.summaries.generate(body.topicName);
    return this.summaries.generateAll();
  }
}
