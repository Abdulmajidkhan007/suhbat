import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const row = (overrides = {}) => ({
  id:           '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f',
  email:        'ali@test.uz',
  passwordHash: '',
  displayName:  'Ali',
  photoUrl:     null,
  bio:          null,
  createdAt:    new Date('2026-10-11T10:00:00.000Z'),
  updatedAt:    new Date('2026-10-11T10:00:00.000Z'),
  ...overrides,
});

describe('AuthService', () => {
  const prisma = {
    user:         { create: vi.fn(), findUnique: vi.fn() },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  };
  const jwt = new JwtService({ secret: 'test-secret' });
  let service: AuthService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AuthService(prisma as unknown as PrismaService, jwt);
  });

  it('register: parolni hash qiladi va token beradi', async () => {
    prisma.user.create.mockImplementation(async ({ data }) => row(data));
    const res = await service.register({ email: 'ali@test.uz', password: '12345678', displayName: 'Ali' });

    const { data } = prisma.user.create.mock.calls[0][0];
    expect(data.passwordHash).not.toBe('12345678');
    expect(await argon2.verify(data.passwordHash, '12345678')).toBe(true);
    expect(res.user).toEqual({
      id: row().id, email: 'ali@test.uz', displayName: 'Ali', photoUrl: null, bio: null,
      createdAt: '2026-10-11T10:00:00.000Z',
    });
    expect(res.user).not.toHaveProperty('passwordHash');
    expect((await jwt.verifyAsync(res.accessToken)).sub).toBe(row().id);

    // refresh token bazaga xom holda emas, hash ko'rinishida yoziladi
    const saved = prisma.refreshToken.create.mock.calls[0][0].data;
    expect(res.refreshToken.length).toBeGreaterThan(40);
    expect(saved.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(saved.tokenHash).not.toBe(res.refreshToken);
    expect(saved.userId).toBe(row().id);
    expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 3600_000);
  });

  it('register: band email → 409', async () => {
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(
      service.register({ email: 'ali@test.uz', password: '12345678', displayName: 'Ali' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('login: to\'g\'ri parol → token, noto\'g\'ri → 401', async () => {
    prisma.user.findUnique.mockResolvedValue(row({ passwordHash: await argon2.hash('12345678') }));
    await expect(service.login({ email: 'ali@test.uz', password: '12345678' })).resolves.toHaveProperty('accessToken');
    await expect(service.login({ email: 'ali@test.uz', password: 'xato' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login: yo\'q foydalanuvchi → 401', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'yoq@test.uz', password: 'x' })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.refresh / logout', () => {
  const prisma = {
    user:         { create: vi.fn(), findUnique: vi.fn() },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  };
  const jwt = new JwtService({ secret: 'test-secret' });
  let service: AuthService;
  const familyId = '11111111-1111-4111-8111-111111111111';
  const tokenRow = (overrides = {}) => ({
    id:        '22222222-2222-4222-8222-222222222222',
    userId:    row().id,
    familyId,
    tokenHash: 'h',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null as Date | null,
    createdAt: new Date(),
    user:      row(),
    ...overrides,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AuthService(prisma as unknown as PrismaService, jwt);
  });

  it('rotatsiya: eskisi bekor qilinadi, o\'sha oilada yangisi beriladi', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(tokenRow());
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const pair = await service.refresh('eski-token');

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: tokenRow().id, revokedAt: null },
      data:  { revokedAt: expect.any(Date) },
    });
    const created = prisma.refreshToken.create.mock.calls[0][0].data;
    expect(created.familyId).toBe(familyId);
    expect(pair.refreshToken).not.toBe('eski-token');
    expect((await jwt.verifyAsync(pair.accessToken)).sub).toBe(row().id);
  });

  it('bekor qilingan token qayta kelsa — butun oila bekor, 401', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(tokenRow({ revokedAt: new Date() }));
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    await expect(service.refresh('ogirlangan')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId, revokedAt: null },
      data:  { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('muddati o\'tgan yoki noma\'lum token — 401', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(tokenRow({ expiresAt: new Date(Date.now() - 1) }));
    await expect(service.refresh('x')).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.refresh('y')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('parallel refresh: ikkinchisi tokenni ololmasa — oila bekor, 401', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(tokenRow());
    prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    await expect(service.refresh('x')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenLastCalledWith({
      where: { familyId, revokedAt: null },
      data:  { revokedAt: expect.any(Date) },
    });
  });

  it('logout: oilani bekor qiladi; noma\'lum token — jim', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(tokenRow());
    await service.logout('x');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId, revokedAt: null },
      data:  { revokedAt: expect.any(Date) },
    });

    prisma.refreshToken.updateMany.mockClear();
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.logout('yoq')).resolves.toBeUndefined();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
