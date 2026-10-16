import { BadRequestException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MailMessage } from '../mail/mailer';
import { Mailer } from '../mail/mailer';
import type { PrismaService } from '../prisma/prisma.service';
import { hashToken } from './auth.service';
import { PasswordResetService } from './password-reset.service';

class FakeMailer extends Mailer {
  readonly provider = 'fake';
  sent: MailMessage[] = [];
  constructor(readonly configured = true) {
    super();
  }
  send = vi.fn(async (m: MailMessage) => {
    this.sent.push(m);
  });
}

const user = { id: 'u1', email: 'ali@b.uz', displayName: 'Ali', username: 'ali_v' };
const env = (over: Record<string, string> = {}) =>
  ({ get: (k: string) => ({ WEB_URL: 'https://web.suhbat.uz/', ...over })[k] }) as unknown as ConfigService;

describe('PasswordResetService', () => {
  const tx = {
    passwordResetToken: { updateMany: vi.fn() },
    user:               { update: vi.fn() },
    refreshToken:       { updateMany: vi.fn() },
  };
  const prisma = {
    user:               { findUnique: vi.fn() },
    passwordResetToken: { count: vi.fn(), updateMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    $transaction:       vi.fn(async (arg: unknown) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg as unknown[]))),
  };
  let mailer: FakeMailer;
  const make = (m: Mailer = mailer, config = env()) => new PasswordResetService(prisma as unknown as PrismaService, m, config);

  beforeEach(() => {
    vi.clearAllMocks();
    mailer = new FakeMailer();
    prisma.passwordResetToken.count.mockResolvedValue(0);
    tx.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
  });

  it('sozlanmagan mailer yoki WEB_URL yo\'q — 503 (hisobni qidirmaydi)', async () => {
    await expect(make(new FakeMailer(false)).requestReset('ali@b.uz', 'ip')).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(make(mailer, env({ WEB_URL: '' })).requestReset('ali@b.uz', 'ip')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('hisob topilsa: eski tokenlar bekor, faqat hash saqlanadi, 30 daqiqa, xat havola bilan', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await make().requestReset('@Ali_V', 'ip');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { username: 'ali_v' } });
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', usedAt: null }, data: { usedAt: expect.any(Date) } });
    const { data } = prisma.passwordResetToken.create.mock.calls[0][0];
    expect(mailer.sent).toHaveLength(1);
    const link = /https:\/\/web\.suhbat\.uz\/reset-password\?token=([\w-]+)/.exec(mailer.sent[0].text);
    expect(link).not.toBeNull();
    const token = link![1];
    expect(token).toHaveLength(43); // 32 bayt base64url
    expect(data.tokenHash).toBe(hashToken(token));
    expect(data.tokenHash).not.toContain(token);
    const ttl = data.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(29 * 60_000);
    expect(ttl).toBeLessThanOrEqual(30 * 60_000);
    expect(mailer.sent[0].to).toBe('ali@b.uz');
  });

  it('hisob yo\'q — jim (xat ham, token ham yo\'q)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(make().requestReset('yoq@b.uz', 'ip')).resolves.toBeUndefined();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('hisob limiti — jim, xat yuborilmaydi', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.passwordResetToken.count.mockResolvedValue(3);
    await expect(make().requestReset('ali@b.uz', 'ip')).resolves.toBeUndefined();
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('IP limiti — 429', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const s = make(mailer, env({ FORGOT_PASSWORD_IP_LIMIT: '2' }));
    await s.requestReset('a@b.uz', '1.1.1.1');
    await s.requestReset('a@b.uz', '1.1.1.1');
    await expect(s.requestReset('a@b.uz', '1.1.1.1')).rejects.toBeInstanceOf(HttpException);
    await expect(s.requestReset('a@b.uz', '2.2.2.2')).resolves.toBeUndefined();
  });

  it('xat yuborish xatosi javobni buzmaydi', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    mailer.send.mockRejectedValueOnce(new Error('Resend 500'));
    await expect(make().requestReset('ali@b.uz', 'ip')).resolves.toBeUndefined();
  });

  it('reset: parol yangilanadi, refresh tokenlar va boshqa tiklash tokenlari bekor', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({ id: 't1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
    await make().resetPassword('tok'.repeat(10), 'yangi-parol-1');
    expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledWith({ where: { tokenHash: hashToken('tok'.repeat(10)) } });
    const hash = tx.user.update.mock.calls[0][0].data.passwordHash;
    expect(await argon2.verify(hash, 'yangi-parol-1')).toBe(true);
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(tx.passwordResetToken.updateMany).toHaveBeenLastCalledWith({ where: { userId: 'u1', usedAt: null }, data: { usedAt: expect.any(Date) } });
  });

  it.each([
    ['yo\'q', null],
    ['ishlatilgan', { id: 't1', userId: 'u1', usedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }],
    ['muddati o\'tgan', { id: 't1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() - 1) }],
  ])('reset: token %s — 400, parol o\'zgarmaydi', async (_name, tokenRow) => {
    prisma.passwordResetToken.findUnique.mockResolvedValue(tokenRow);
    await expect(make().resetPassword('x'.repeat(30), 'yangi-parol-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('reset: parallel so\'rovda token allaqachon olingan — 400', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({ id: 't1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
    tx.passwordResetToken.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(make().resetPassword('x'.repeat(30), 'yangi-parol-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
