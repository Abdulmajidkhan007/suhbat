import { Body, Controller, Get, HttpCode, Ip, Post, Req, UseGuards } from '@nestjs/common';
import {
  ForgotPasswordInputSchema, LoginInputSchema, LogoutInputSchema, RefreshInputSchema, RegisterInputSchema, ResetPasswordInputSchema,
} from '@suhbat/core';
import type {
  ForgotPasswordInput, ForgotPasswordResponse, LoginInput, LogoutInput, RefreshInput, RegisterInput, ResetPasswordInput,
} from '@suhbat/core';
import { AuthThrottle } from '../common/throttle';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthedRequest } from './jwt-auth.guard';
import { PasswordResetService } from './password-reset.service';

/** Hisob bor-yo'qligidan qat'i nazar aynan shu javob. */
export const FORGOT_PASSWORD_RESPONSE: ForgotPasswordResponse = {
  message: 'Agar bunday hisob bo\'lsa, parolni tiklash havolasi emailga yuborildi. Pochtangizni (va "Spam" papkasini) tekshiring.',
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

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

  @AuthThrottle()
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordInputSchema)) body: ForgotPasswordInput,
    @Ip() ip: string,
  ): Promise<ForgotPasswordResponse> {
    await this.passwordReset.requestReset(body.emailOrUsername, ip);
    return FORGOT_PASSWORD_RESPONSE;
  }

  @AuthThrottle()
  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(@Body(new ZodValidationPipe(ResetPasswordInputSchema)) body: ResetPasswordInput): Promise<void> {
    await this.passwordReset.resetPassword(body.token, body.newPassword);
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
