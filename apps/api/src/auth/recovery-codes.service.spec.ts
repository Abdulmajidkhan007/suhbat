import { normalizeRecoveryCode, RECOVERY_CODE_ALPHABET, RECOVERY_CODE_LENGTH } from '@suhbat/core';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { generateRecoveryCode, RecoveryCodesService } from './recovery-codes.service';

describe('generateRecoveryCode', () => {
  it('12 belgi, faqat alifbodan; normallashtirishdan o\'zgarmay o\'tadi; takrorlanmaydi', () => {
    const seen = new Set<string>();
    const counts = new Map<string, number>();
    for (let i = 0; i < 2000; i++) {
      const c = generateRecoveryCode();
      expect(c).toHaveLength(RECOVERY_CODE_LENGTH);
      expect(normalizeRecoveryCode(c)).toBe(c);
      seen.add(c);
      for (const ch of c) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    expect(seen.size).toBe(2000);
    // 24 000 belgi / 32 harf ≈ 750 — har harf ishlatiladi, keskin og'ish yo'q
    expect(counts.size).toBe(RECOVERY_CODE_ALPHABET.length);
    for (const n of counts.values()) expect(n).toBeGreaterThan(550);
  });
});

describe('RecoveryCodesService.recover — urinishlar cheklovi', () => {
  const tx = {
    recoveryCode:       { updateMany: vi.fn() },
    user:               { update: vi.fn() },
    refreshToken:       { updateMany: vi.fn() },
    passwordResetToken: { updateMany: vi.fn() },
  };
  const prisma = {
    user:         { findUnique: vi.fn() },
    recoveryCode: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
  };
  const config = { get: () => undefined, getOrThrow: () => 'secret' } as unknown as ConfigService;
  const make = () => new RecoveryCodesService(prisma as unknown as PrismaService, config);
  const input = { login: 'ali@b.uz', code: 'ABCD-EFGH-JKMN', newPassword: 'yangi-parol-123' };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.recoveryCode.findUnique.mockResolvedValue(null);
    tx.recoveryCode.updateMany.mockResolvedValue({ count: 1 });
  });

  it('noto\'g\'ri kod 4 marta — 400, 5-sida — 429; keyin to\'g\'ri kod ham o\'tmaydi (kod tekshirilmaydi)', async () => {
    const s = make();
    for (let i = 0; i < 4; i++) await expect(s.recover(input, `ip${i}`)).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.recover(input, 'ip5')).rejects.toMatchObject({ status: 429 });
    prisma.recoveryCode.findUnique.mockClear();
    prisma.recoveryCode.findUnique.mockResolvedValue({ id: 'c1', usedAt: null });
    await expect(s.recover(input, 'ip6')).rejects.toMatchObject({ status: 429 });
    expect(prisma.recoveryCode.findUnique).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('mavjud bo\'lmagan login ham xuddi shunday sanaladi (hisob borligi oshkor bo\'lmaydi)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const s = make();
    for (let i = 0; i < 4; i++) await expect(s.recover(input, `ip${i}`)).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.recover(input, 'ip5')).rejects.toMatchObject({ status: 429 });
  });

  it('blok boshqa loginga ta\'sir qilmaydi', async () => {
    const s = make();
    for (let i = 0; i < 5; i++) await s.recover(input, `ip${i}`).catch(() => undefined);
    await expect(s.recover({ ...input, login: 'boshqa@b.uz' }, 'ipX')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('to\'g\'ri kod urinishlar hisobini nolga tushiradi', async () => {
    const s = make();
    for (let i = 0; i < 4; i++) await s.recover(input, `ip${i}`).catch(() => undefined);
    prisma.recoveryCode.findUnique.mockResolvedValue({ id: 'c1', usedAt: null });
    await expect(s.recover(input, 'ipOK')).resolves.toBeUndefined();
    prisma.recoveryCode.findUnique.mockResolvedValue(null);
    for (let i = 0; i < 4; i++) await expect(s.recover(input, `ipB${i}`)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('parallel "olingan" kod (updateMany 0) ham noto\'g\'ri urinish sifatida sanaladi', async () => {
    prisma.recoveryCode.findUnique.mockResolvedValue({ id: 'c1', usedAt: null });
    tx.recoveryCode.updateMany.mockResolvedValue({ count: 0 });
    await expect(make().recover(input, 'ip')).rejects.toBeInstanceOf(BadRequestException);
  });
});
