// Emailsiz parol tiklash — bir martalik kodlar; parolni o'zgartirish (haqiqiy Postgres).
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RECOVERY_CODE_COUNT } from '@suhbat/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { RECOVER_FAILED_MESSAGE } from '../src/auth/recovery-codes.service';
import { PrismaService } from '../src/prisma/prisma.service';

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const emailOf = (n: string) => `${n}-${stamp}@recovery.e2e.uz`;
const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

const createApp = async (env: Record<string, string> = {}) => {
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  try {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    return app;
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

describe('tiklash kodlari (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const server = () => app.getHttpServer();
  const register = (n: string) =>
    request(server()).post('/auth/register').send({ email: emailOf(n), password: '12345678', displayName: `rc-${n} ${stamp}` });
  const login = (loginId: string, password: string) => request(server()).post('/auth/login').send({ login: loginId, password });
  const recover = (body: Record<string, string>) => request(server()).post('/auth/recover').send(body);

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: `-${stamp}@recovery.e2e.uz` } } });
    await app.close();
  });

  it('ro\'yxatdan o\'tishda 10 ta kod bir marta beriladi; bazada faqat hash', async () => {
    const res = await register('ali').expect(201);
    const codes: string[] = res.body.recoveryCodes;
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    for (const c of codes) expect(c).toMatch(CODE_RE);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);

    const rows = await prisma.recoveryCode.findMany({ where: { userId: res.body.user.id } });
    expect(rows).toHaveLength(RECOVERY_CODE_COUNT);
    const stored = JSON.stringify(rows);
    for (const c of codes) {
      expect(stored).not.toContain(c);
      expect(stored).not.toContain(c.replace(/-/g, ''));
    }

    // Login'da kodlar yo'q; holat — 10 ta qolgan
    const signedIn = await login(emailOf('ali'), '12345678').expect(200);
    expect(signedIn.body.recoveryCodes).toBeUndefined();
    const status = await request(server()).get('/auth/recovery-codes').set('Authorization', `Bearer ${signedIn.body.accessToken}`).expect(200);
    expect(status.body).toMatchObject({ remaining: RECOVERY_CODE_COUNT });
    expect(status.body.generatedAt).toEqual(expect.any(String));
  });

  it('to\'g\'ri kod → parol o\'zgaradi, sessiyalar yopiladi; kod qayta ishlamaydi; noto\'g\'ri/yo\'q login — bir xil javob', async () => {
    const reg = await register('vali').expect(201);
    const [code, second] = reg.body.recoveryCodes as string[];
    const refreshToken: string = reg.body.refreshToken;

    // Noto'g'ri kod, mavjud bo'lmagan login, noto'g'ri formatdagi kod — bir xil 400 va matn
    const wrong = await recover({ login: emailOf('vali'), code: 'AAAA-BBBB-CCCC', newPassword: 'yangi-parol-1' }).expect(400);
    const ghost = await recover({ login: emailOf('yoq'), code: code!, newPassword: 'yangi-parol-1' }).expect(400);
    const ghostUser = await recover({ login: `@yoq_${stamp}`, code: code!, newPassword: 'yangi-parol-1' }).expect(400);
    const malformed = await recover({ login: emailOf('vali'), code: '###', newPassword: 'yangi-parol-1' }).expect(400);
    for (const r of [wrong, ghost, ghostUser, malformed]) expect(r.body.message).toBe(RECOVER_FAILED_MESSAGE);
    await login(emailOf('vali'), '12345678').expect(200);

    // Kichik harf va probellar bilan kiritsa ham qabul qilinadi
    const typed = ` ${code!.toLowerCase().replace(/-/g, ' ')} `;
    await recover({ login: emailOf('vali').toUpperCase(), code: typed, newPassword: 'yangi-parol-1' }).expect(204);

    await login(emailOf('vali'), '12345678').expect(401);
    await login(emailOf('vali'), 'yangi-parol-1').expect(200);
    // Eski refresh token bekor
    await request(server()).post('/auth/refresh').send({ refreshToken }).expect(401);

    // Shu kod qayta — rad; boshqa kod ishlaydi; qolgan soni kamayadi
    const reused = await recover({ login: emailOf('vali'), code: code!, newPassword: 'yangi-parol-2' }).expect(400);
    expect(reused.body.message).toBe(RECOVER_FAILED_MESSAGE);
    await recover({ login: emailOf('vali'), code: second!, newPassword: 'yangi-parol-2' }).expect(204);
    const token = (await login(emailOf('vali'), 'yangi-parol-2').expect(200)).body.accessToken as string;
    const status = await request(server()).get('/auth/recovery-codes').set('Authorization', `Bearer ${token}`).expect(200);
    expect(status.body.remaining).toBe(RECOVERY_CODE_COUNT - 2);
  });

  it('parallel: bitta kod bilan bir vaqtda ikki so\'rov — faqat bittasi o\'tadi', async () => {
    const reg = await register('gani').expect(201);
    const code = (reg.body.recoveryCodes as string[])[0]!;
    const results = await Promise.all([
      recover({ login: emailOf('gani'), code, newPassword: 'parol-birinchi' }),
      recover({ login: emailOf('gani'), code, newPassword: 'parol-ikkinchi' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([204, 400]);
  });

  it('qayta yaratish: joriy parol shart, eskilari bekor; parolni o\'zgartirish — boshqa sessiyalar yopiladi', async () => {
    const reg = await register('hasan').expect(201);
    const oldCodes = reg.body.recoveryCodes as string[];
    const auth = { Authorization: `Bearer ${reg.body.accessToken}` };

    await request(server()).post('/auth/recovery-codes').set(auth).send({ password: 'xato-parol' }).expect(400);
    await request(server()).post('/auth/recovery-codes').send({ password: '12345678' }).expect(401);
    const regen = await request(server()).post('/auth/recovery-codes').set(auth).send({ password: '12345678' }).expect(200);
    expect(regen.body.codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(regen.body.codes).not.toContain(oldCodes[0]);
    await recover({ login: emailOf('hasan'), code: oldCodes[0]!, newPassword: 'yangi-parol-1' }).expect(400);

    // Parolni o'zgartirish
    const other = await login(emailOf('hasan'), '12345678').expect(200); // boshqa qurilma
    await request(server()).post('/auth/change-password').set(auth)
      .send({ currentPassword: 'xato', newPassword: 'yangi-parol-1' }).expect(400);
    await request(server()).post('/auth/change-password').set(auth)
      .send({ currentPassword: '12345678', newPassword: 'qisqa' }).expect(400);
    const changed = await request(server()).post('/auth/change-password').set(auth)
      .send({ currentPassword: '12345678', newPassword: 'yangi-parol-1' }).expect(200);
    expect(changed.body).toMatchObject({ accessToken: expect.any(String), refreshToken: expect.any(String) });
    await request(server()).post('/auth/refresh').send({ refreshToken: other.body.refreshToken }).expect(401);
    await request(server()).post('/auth/refresh').send({ refreshToken: changed.body.refreshToken }).expect(200);
    await login(emailOf('hasan'), 'yangi-parol-1').expect(200);
    // Yangi kodlar hali ham ishlaydi (parol o'zgarishi kodlarga tegmaydi)
    await recover({ login: emailOf('hasan'), code: regen.body.codes[0], newPassword: 'yangi-parol-2' }).expect(204);
  });
});

describe('tiklash kodlari: cheklov (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp({ RECOVER_ACCOUNT_LIMIT: '3', RECOVER_IP_LIMIT: '100' });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: `-${stamp}@recovery.e2e.uz` } } });
    await app.close();
  });

  it('login bo\'yicha: limitdan keyin to\'g\'ri kod ham 429; mavjud bo\'lmagan login ham xuddi shunday', async () => {
    const server = app.getHttpServer();
    const reg = await request(server).post('/auth/register')
      .send({ email: emailOf('limit'), password: '12345678', displayName: 'limit' }).expect(201);
    const code = (reg.body.recoveryCodes as string[])[0]!;
    const attempt = (loginId: string, c = 'AAAA-BBBB-CCCC') =>
      request(server).post('/auth/recover').send({ login: loginId, code: c, newPassword: 'yangi-parol-1' });

    for (let i = 0; i < 3; i++) await attempt(emailOf('limit')).expect(400);
    await attempt(emailOf('limit'), code).expect(429);
    for (let i = 0; i < 3; i++) await attempt(emailOf('yoq-limit')).expect(400);
    await attempt(emailOf('yoq-limit')).expect(429);
    // Kod sarflanmadi
    expect(await prisma.recoveryCode.count({ where: { userId: reg.body.user.id, usedAt: null } })).toBe(RECOVERY_CODE_COUNT);
  });
});
