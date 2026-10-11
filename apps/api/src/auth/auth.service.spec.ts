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
  createdAt:    new Date('2026-10-11T10:00:00.000Z'),
  updatedAt:    new Date('2026-10-11T10:00:00.000Z'),
  ...overrides,
});

describe('AuthService', () => {
  const prisma = { user: { create: vi.fn(), findUnique: vi.fn() } };
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
      id: row().id, email: 'ali@test.uz', displayName: 'Ali', photoUrl: null,
      createdAt: '2026-10-11T10:00:00.000Z',
    });
    expect(res.user).not.toHaveProperty('passwordHash');
    expect((await jwt.verifyAsync(res.accessToken)).sub).toBe(row().id);
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
