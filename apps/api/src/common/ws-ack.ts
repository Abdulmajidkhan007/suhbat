import { HttpException } from '@nestjs/common';
import type { Logger } from '@nestjs/common';
import type { WsAck } from '@suhbat/core';
import type { ZodType } from 'zod';

/**
 * WS handler'ini zod tekshiruvi va ack bilan o'raydi: `HttpException` matni mijozga
 * qaytadi, kutilmagan xato logga yoziladi va mijozga umumiy matn bilan.
 */
export const runWithAck = async <P, R>(
  logger: Logger,
  schema: ZodType<P>,
  body: unknown,
  fn: (p: P) => Promise<R>,
): Promise<WsAck<R>> => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, error: 'Validation failed' };
  try {
    return { ok: true, data: await fn(parsed.data) };
  } catch (e) {
    if (e instanceof HttpException) return { ok: false, error: e.message };
    logger.error('ws handler', e as Error);
    return { ok: false, error: 'Kutilmagan xato' };
  }
};
