import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { NewsStore } from '../store/news.store';

@Global()
@Module({
  providers: [PrismaService, NewsStore],
  exports: [PrismaService, NewsStore],
})
export class PrismaModule {}
