import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SubscriptionTier } from './types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body()
    body: {
      email?: string;
      name?: string;
      tier?: SubscriptionTier;
      role?: 'reader' | 'journalist' | 'admin';
    },
  ) {
    if (!body?.email || !body.email.includes('@')) {
      throw new BadRequestException('A valid email address is required');
    }
    return this.authService.register({
      email: body.email,
      name: body.name,
      tier: body.tier,
      role: body.role,
    });
  }

  @Post('login')
  async login(@Body() body: { email?: string }) {
    if (!body?.email || !body.email.includes('@')) {
      throw new BadRequestException('A valid email address is required');
    }
    return this.authService.login(body.email);
  }

  @Get('me')
  async getMe(@Headers() headers: Record<string, string | undefined>) {
    const token =
      headers.authorization ||
      headers['x-api-key'] ||
      headers['x-user-id'];

    const user = await this.authService.validateTokenOrHeader(token);
    if (!user) {
      throw new UnauthorizedException('Invalid or missing authentication credentials');
    }
    return { user };
  }

  @Post('team')
  async createTeam(
    @Headers() headers: Record<string, string | undefined>,
    @Body() body: { name?: string },
  ) {
    const token =
      headers.authorization ||
      headers['x-api-key'] ||
      headers['x-user-id'];

    const user = await this.authService.validateTokenOrHeader(token);
    if (!user) {
      throw new UnauthorizedException('Authentication required to create a team');
    }
    if (!body?.name?.trim()) {
      throw new BadRequestException('Team name is required');
    }
    const team = await this.authService.createTeam(body.name.trim(), user.id);
    return { team };
  }
}
