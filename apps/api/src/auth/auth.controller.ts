import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { LoginInputSchema, LogoutInputSchema, RefreshInputSchema, RegisterInputSchema } from '@suhbat/core';
import type { LoginInput, LogoutInput, RefreshInput, RegisterInput } from '@suhbat/core';
import { AuthThrottle } from '../common/throttle';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthedRequest } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @AuthThrottle()
  @Post('register')
  register(@Body(new ZodValidationPipe(RegisterInputSchema)) body: RegisterInput) {
    return this.auth.register(body);
  }

  @AuthThrottle()
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(LoginInputSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  @AuthThrottle()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(RefreshInputSchema)) body: RefreshInput) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodValidationPipe(LogoutInputSchema)) body: LogoutInput) {
    await this.auth.logout(body.refreshToken, body.deviceToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthedRequest) {
    return this.auth.me(req.user.sub);
  }
}
