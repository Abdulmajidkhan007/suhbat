import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, Ip, Logger, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
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
import { bindRefreshCookie, clearRefreshCookie, isCookieMode, readRefreshCookie } from './refresh-cookie';
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
  async register(
    @Body(new ZodValidationPipe(RegisterInputSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const created = await this.auth.register(body);
    this.activity.record({ type: 'register', userId: created.user.id, ...httpContext(req) });
    const recoveryCodes = await this.recovery.generate(created.user.id).catch((e: unknown) => {
      this.logger.error(`tiklash kodlari yaratilmadi (${created.user.id}): ${e instanceof Error ? e.message : String(e)}`);
      return [];
    });
    return bindRefreshCookie(req, res, { ...created, recoveryCodes });
  }

  @AuthThrottle()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(LoginInputSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = httpContext(req);
    try {
      const out = await this.auth.login(body);
      this.activity.record({ type: 'login', userId: out.user.id, ...ctx });
      return bindRefreshCookie(req, res, out);
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
  async refresh(
    @Body(new ZodValidationPipe(RefreshInputSchema.partial())) body: Partial<RefreshInput>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Cookie rejimida token faqat cookie'dan olinadi (tanadagisi e'tiborsiz).
    const token = isCookieMode(req) ? readRefreshCookie(req) : body.refreshToken;
    if (!token) throw new BadRequestException('refreshToken kerak');
    try {
      return bindRefreshCookie(req, res, await this.auth.refresh(token));
    } catch (e) {
      if (isCookieMode(req)) clearRefreshCookie(res);
      throw e;
    }
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const out = await this.auth.changePassword(req.user.sub, body);
    this.activity.record({ type: 'password_change', userId: req.user.sub, ...httpContext(req) });
    return bindRefreshCookie(req, res, out);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(LogoutInputSchema.partial({ refreshToken: true }))) body: Partial<LogoutInput>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieMode = isCookieMode(req);
    const token = cookieMode ? readRefreshCookie(req) : body.refreshToken;
    if (cookieMode) clearRefreshCookie(res);
    if (!token) return;
    const userId = await this.auth.logout(token, body.deviceToken);
    if (userId) this.activity.record({ type: 'logout', userId, ...httpContext(req) });
  }

  @Get('me')
  @AllowPendingPassword()
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthedRequest) {
    return this.auth.me(req.user.sub);
  }
}
