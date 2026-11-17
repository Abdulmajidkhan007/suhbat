// Haqiqiy Postgres bilan: `npm run db:up`, `npm run db:deploy -w @suhbat/api`,
// so'ng `npm run test:e2e -w @suhbat/api`. DATABASE_URL va JWT_SECRET kerak.
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('API (e2e)', () => {
  let app: INestApplication;
  const email = `e2e-${Date.now()}@test.uz`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.get(PrismaService).user.deleteMany({ where: { email } });
    await app.close();
  });

  it('GET /health', async () => {
    await request(app.getHttpServer()).get('/health').expect(200, { status: 'ok', db: 'up' });
  });

  it('register → login → me', async () => {
    const server = app.getHttpServer();
    const reg = await request(server)
      .post('/auth/register')
      .send({ email, password: '12345678', displayName: 'E2E' })
      .expect(201);
    expect(reg.body.user.email).toBe(email);

    await request(server).post('/auth/register').send({ email, password: '12345678', displayName: 'E2E' }).expect(409);
    await request(server).post('/auth/login').send({ email, password: 'xato-parol' }).expect(401);

    const login = await request(server).post('/auth/login').send({ email, password: '12345678' }).expect(200);
    const me = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(me.body).toEqual(reg.body.user);

    await request(server).get('/auth/me').expect(401);
  });
});

describe('Veb refresh cookie (e2e)', () => {
  let app: INestApplication;
  const email = `e2e-cookie-${Date.now()}@test.uz`;
  const cookieMode = { 'X-Suhbat-Cookie': '1' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.get(PrismaService).user.deleteMany({ where: { email } });
    await app.close();
  });

  const cookieOf = (res: request.Response): string => {
    const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('suhbat_rt='));
    expect(raw).toBeDefined();
    return raw as string;
  };

  it('login: refresh token httpOnly cookie\'da, tanada yo\'q', async () => {
    const server = app.getHttpServer();
    await request(server).post('/auth/register').send({ email, password: '12345678', displayName: 'C' }).expect(201);
    const login = await request(server).post('/auth/login').set(cookieMode).send({ email, password: '12345678' }).expect(200);
    expect(login.body.refreshToken).toBe('');
    const cookie = cookieOf(login);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/auth/);
  });

  it('/auth/refresh cookie bilan ishlaydi va rotatsiya qiladi; tanadagi token e\'tiborsiz', async () => {
    const server = app.getHttpServer();
    const login = await request(server).post('/auth/login').set(cookieMode).send({ email, password: '12345678' }).expect(200);
    const first = cookieOf(login).split(';')[0];
    const refreshed = await request(server).post('/auth/refresh').set(cookieMode).set('Cookie', first).send({}).expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    expect(refreshed.body.refreshToken).toBe('');
    const second = cookieOf(refreshed).split(';')[0];
    expect(second).not.toBe(first);
    // Eski cookie grace oynasi (REFRESH_GRACE_MS) ichida ruxsat — ko'p tabli poyga uchun (auth.service).
    await request(server).post('/auth/refresh').set(cookieMode).set('Cookie', first).send({}).expect(200);
  });

  it('sarlavhasiz cookie e\'tiborsiz (CSRF), cookiesiz — 400; tanadagi rejim o\'zgarmagan', async () => {
    const server = app.getHttpServer();
    const login = await request(server).post('/auth/login').send({ email, password: '12345678' }).expect(200);
    expect(login.headers['set-cookie']).toBeUndefined();
    expect(login.body.refreshToken).toBeTruthy();
    await request(server).post('/auth/refresh').set('Cookie', 'suhbat_rt=' + login.body.refreshToken).send({}).expect(400);
    await request(server).post('/auth/refresh').set(cookieMode).send({}).expect(400);
    await request(server).post('/auth/refresh').send({ refreshToken: login.body.refreshToken }).expect(200);
  });

  it('logout cookie\'ni o\'chiradi', async () => {
    const server = app.getHttpServer();
    const login = await request(server).post('/auth/login').set(cookieMode).send({ email, password: '12345678' }).expect(200);
    const c = cookieOf(login).split(';')[0];
    const out = await request(server).post('/auth/logout').set(cookieMode).set('Cookie', c).send({}).expect(204);
    expect(cookieOf(out)).toMatch(/suhbat_rt=;/);
    await request(server).post('/auth/refresh').set(cookieMode).set('Cookie', c).send({}).expect(401);
  });
});
