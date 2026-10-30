import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TierGuard } from './tier.guard';

@Module({
  imports: [PrismaModule],
  providers: [AuthService, TierGuard],
  controllers: [AuthController],
  exports: [AuthService, TierGuard],
})
export class AuthModule {}
