import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET kamida 32 belgi bo‘lishi kerak (openssl rand -base64 48)'),
  CORS_ORIGIN: z.string().optional(),
});

export interface BootEnv {
  production: boolean;
  /** `true` — faqat production bo'lmaganda va CORS_ORIGIN bo'sh bo'lganda (dev). */
  corsOrigins: string[] | true;
}

/** Ishga tushishda muhitni tekshiradi; xato bo'lsa aniq xabar bilan tashlaydi. */
export function validateBootEnv(env: NodeJS.ProcessEnv = process.env): BootEnv {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Muhit sozlamalari noto‘g‘ri: ${msg}`);
  }
  const production = parsed.data.NODE_ENV === 'production';
  const list = (parsed.data.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (list.length === 0) {
    if (production) {
      throw new Error('Muhit sozlamalari noto‘g‘ri: production’da CORS_ORIGIN majburiy (vergul bilan origin’lar)');
    }
    return { production, corsOrigins: true };
  }
  return { production, corsOrigins: list };
}
