import { Controller, Get, Query } from '@nestjs/common';
import { normalizeUsername, UsernameAvailabilityQuerySchema, usernameProblem } from '@suhbat/core';
import type { UsernameAvailability, UsernameAvailabilityQuery } from '@suhbat/core';
import { AuthService, USERNAME_TAKEN_MESSAGE } from '../auth/auth.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * Ochiq (tokensiz) — ro'yxatdan o'tish formasidagi jonli tekshiruv uchun.
 * Usernamelar ochiq ma'lumot (qidiruvda ko'rinadi), shuning uchun "band" deyish
 * hech narsani oshkor qilmaydi; email bo'yicha bunday tekshiruv YO'Q.
 */
@Controller('users')
export class UsernameController {
  constructor(private readonly auth: AuthService) {}

  @Get('username-available')
  async available(
    @Query(new ZodValidationPipe(UsernameAvailabilityQuerySchema)) query: UsernameAvailabilityQuery,
  ): Promise<UsernameAvailability> {
    const username = normalizeUsername(query.u);
    const problem = usernameProblem(username);
    if (problem) return { username, available: false, reason: problem };
    const taken = await this.auth.usernameTaken(username);
    return { username, available: !taken, reason: taken ? USERNAME_TAKEN_MESSAGE : null };
  }
}
