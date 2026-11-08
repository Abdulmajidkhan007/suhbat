import { describe, expect, it } from 'vitest';
import { ActivityMetaSchema, AdminActivityQuerySchema, privacySections } from './activity.js';

describe('faoliyat jurnali sxemalari', () => {
  it('meta — oq ro\'yxat: matn uchun maydon yo\'q (noma\'lum kalitlar tashlab yuboriladi)', () => {
    const parsed = ActivityMetaSchema.parse({ length: 5, content: 'maxfiy matn', text: 'x', hasAttachment: true });
    expect(parsed).toEqual({ length: 5, hasAttachment: true });
    expect(JSON.stringify(parsed)).not.toContain('maxfiy');
  });

  it('so\'rov: bo\'sh sana e\'tiborsiz, noma\'lum tur rad', () => {
    expect(AdminActivityQuerySchema.parse({ from: '', type: 'message_send' })).toMatchObject({ type: 'message_send', page: 1, pageSize: 20 });
    expect(AdminActivityQuerySchema.safeParse({ type: 'nomalum' }).success).toBe(false);
    expect(AdminActivityQuerySchema.safeParse({ from: 'kecha' }).success).toBe(false);
  });

  it('maxfiylik matni: muddat va "matn o\'qilmaydi" rost aytiladi', () => {
    const text = privacySections(30).flatMap((s) => [s.title, ...s.items]).join('\n');
    expect(text).toContain('30 kun saqlanadi');
    expect(text).toMatch(/MATNI administratorga ko'rinmaydi/);
    expect(text).toMatch(/shikoyat/);
  });
});
