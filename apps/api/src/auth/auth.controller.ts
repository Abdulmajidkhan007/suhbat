import { Body, Controller, Get, HttpCode, HttpException, Ip, Logger, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  ChangePasswordInputSchema, ForgotPasswordInputSchema, LoginInputSchema, LogoutInputSchema, RecoverInputSchema, RefreshInputSchema,
  RegenerateRecoveryCodesInputSchema, RegisterInputSchema, ResetPasswordInputSchema,
} from '@suhbat/core';
import type {
  AuthResponse, ChangePasswordInput, ForgotPasswordInput, ForgotPasswordResponse, LoginInput, LogoutInput, RecoverInput,
  RecoveryCodesResponse, RecoveryCodesStatus, RefreshInput, RegenerateRecoveryCodesInput, RegisterInput, ResetPasswordInput,
} from '@suhbat/core';
import { ActivityService } from '../activity/activity.service';
import { httpContext } from '../activity/request-context';
import { AuthThrottle } from '../common/throttle';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { AllowPendingPassword, JwtAuthGuard } from './jwt-auth.guard';
import type { AuthedRequest } from './jwt-auth.guard';
import { PasswordResetService } from './password-reset.service';
import { RecoveryCodesService } from './recovery-codes.service';

/** Hisob bor-yo'qligidan qat'i nazar aynan shu javob. */
export const FORGOT_PASSWORD_RESPONSE: ForgotPasswordResponse = {
  message: 'Agar bunday hisob bo\'lsa, parolni tiklash havolasi emailga yuborildi. Pochtangizni (va "Spam" papkasini) tekshiring.',
};

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
    private readonly recovery: RecoveryCodesService,
    private readonly activity: ActivityService,
  ) {}

  /**
   * Javobda `recoveryCodes` — parolni tiklash kodlari, faqat shu yerda bir marta ko'rsatiladi.
   * Kod yaratib bo'lmasa ham hisob yaratilgan — bo'sh ro'yxat (Sozlamalarda yaratish taklif qilinadi).
   */
  @AuthThrottle()
  @Post('register')
  async register(@Body(new ZodValidationPipe(RegisterInputSchema)) body: RegisterInput, @Req() req: Request): Promise<AuthResponse> {
    const res = await this.auth.register(body);
    this.activity.record({ type: 'register', userId: res.user.id, ...httpContext(req) });
    const recoveryCodes = await this.recovery.generate(res.user.id).catch((e: unknown) => {
      this.logger.error(`tiklash kodlari yaratilmadi (${res.user.id}): ${e instanceof Error ? e.message : String(e)}`);
      return [];
    });
    return { ...res, recoveryCodes };
  }

  @AuthThrottle()
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(LoginInputSchema)) body: LoginInput, @Req() req: Request) {
    const ctx = httpContext(req);
    try {
      const res = await this.auth.login(body);
      this.activity.record({ type: 'login', userId: res.user.id, ...ctx });
      return res;
    } catch (e) {
      const status = e instanceof HttpException ? e.getStatus() : 0;
      if (status === 401 || status === 403) {
        // Kiritilgan login/parol yozilmaydi — faqat kim (agar hisob bor bo'lsa) va sabab turi.
        void this.auth.userIdOf(body.login).catch(() => null).then((userId) => {
          this.activity.record({ type: 'login_failed', userId, meta: { reason: status === 403 ? 'blocked' : 'bad_credentials' }, ...ctx });
        });
      }
      throw e;
    }
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

  /** Emailsiz tiklash: login + bir martalik kod. Xato javobi hisob borligidan qat'i nazar bir xil. */
  @AuthThrottle()
  @Post('recover')
  @HttpCode(204)
  async recover(@Body(new ZodValidationPipe(RecoverInputSchema)) body: RecoverInput, @Ip() ip: string): Promise<void> {
    await this.recovery.recover(body, ip);
  }

  @Get('recovery-codes')
  @UseGuards(JwtAuthGuard)
  recoveryCodesStatus(@Req() req: AuthedRequest): Promise<RecoveryCodesStatus> {
    return this.recovery.status(req.user.sub);
  }

  /** Joriy parol bilan: eski kodlar bekor, yangilari bir marta qaytadi. */
  @AuthThrottle()
  @Post('recovery-codes')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async regenerateRecoveryCodes(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(RegenerateRecoveryCodesInputSchema)) body: RegenerateRecoveryCodesInput,
  ): Promise<RecoveryCodesResponse> {
    return { codes: await this.recovery.regenerate(req.user.sub, body.password) };
  }

  /** Boshqa qurilmalardagi sessiyalar yopiladi; shu qurilmaga yangi tokenlar qaytadi. */
  @AuthThrottle()
  @Post('change-password')
  @HttpCode(200)
  @AllowPendingPassword()
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(ChangePasswordInputSchema)) body: ChangePasswordInput,
  ): Promise<AuthResponse> {
    const res = await this.auth.changePassword(req.user.sub, body);
    this.activity.record({ type: 'password_change', userId: req.user.sub, ...httpContext(req) });
    return res;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodValidationPipe(LogoutInputSchema)) body: LogoutInput, @Req() req: Request) {
    const userId = await this.auth.logout(body.refreshToken, body.deviceToken);
    if (userId) this.activity.record({ type: 'logout', userId, ...httpContext(req) });
  }

  @Get('me')
  @AllowPendingPassword()
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthedRequest) {
    return this.auth.me(req.user.sub);
  }
}
