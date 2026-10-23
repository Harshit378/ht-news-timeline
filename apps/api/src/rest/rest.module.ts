import { Module } from '@nestjs/common';
import { IngestionModule } from '../ingestion/ingestion.module';
import { ArticlesController } from './articles.controller';
import { BookmarksController } from './bookmarks.controller';
import { BreakingController } from './breaking.controller';
import { FeedController } from './feed.controller';
import { HealthController } from './health.controller';
import { SearchController } from './search.controller';
import { TimelineController } from './timeline.controller';
import { TopicsController } from './topics.controller';
import { TrendingController } from './trending.controller';

@Module({
  imports: [IngestionModule],
  controllers: [
    HealthController,
    FeedController,
    ArticlesController,
    SearchController,
    TimelineController,
    TrendingController,
    TopicsController,
    BookmarksController,
    BreakingController,
  ],
})
export class RestModule {}
