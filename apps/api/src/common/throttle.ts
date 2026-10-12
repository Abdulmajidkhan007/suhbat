import type { ExecutionContext } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

const AUTH_THROTTLE = 'suhbat:auth-throttle';

/** Qattiqroq cheklov (login/register/refresh): parol terish va token aylantirishga qarshi. */
export const AuthThrottle = () => SetMetadata(AUTH_THROTTLE, true);

const reflector = new Reflector();
const isAuthRoute = (ctx: ExecutionContext) => reflector.get<boolean>(AUTH_THROTTLE, ctx.getHandler()) === true;
const num = (config: ConfigService, key: string, fallback: number) => {
  const n = Number(config.get<string>(key));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * Ikki nomli cheklov (IP va endpoint bo'yicha — har endpoint o'z hisobiga ega): `default` — barcha REST, `auth` — faqat
 * `@AuthThrottle()` belgili endpointlar (ular `default` ga kirmaydi). WebSocket
 * kontekstida ikkalasi ham o'tkazib yuboriladi (u yerda `RateLimiter`).
 * Sozlanadi: THROTTLE_TTL_MS, THROTTLE_LIMIT, THROTTLE_AUTH_LIMIT.
 */
export const throttleOptions = (config: ConfigService): ThrottlerModuleOptions => {
  const ttl = num(config, 'THROTTLE_TTL_MS', 60_000);
  return {
    throttlers: [
      {
        name:   'default',
        ttl,
        limit:  num(config, 'THROTTLE_LIMIT', 300),
        skipIf: (ctx) => ctx.getType() !== 'http' || isAuthRoute(ctx),
      },
      {
        name:   'auth',
        ttl,
        limit:  num(config, 'THROTTLE_AUTH_LIMIT', 10),
        skipIf: (ctx) => ctx.getType() !== 'http' || !isAuthRoute(ctx),
      },
    ],
  };
};
