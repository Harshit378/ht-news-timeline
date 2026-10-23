import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    return {
      ok: true,
      database: (await this.prisma.isReady()) ? 'postgres' : 'memory',
    };
  }
}
