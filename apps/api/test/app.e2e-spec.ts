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
