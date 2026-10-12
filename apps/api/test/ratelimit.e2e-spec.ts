// REST rate limit: 429 javoblari. Limitlar shu fayl uchun kichraytirilgan
// (boshqa e2e fayllarda vitest.config'dagi katta qiymatlar — testlar sekinlashmaydi).
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';

const limitEnv = { THROTTLE_LIMIT: '6', THROTTLE_AUTH_LIMIT: '3' };

describe('REST rate limit (e2e)', () => {
  let app: INestApplication;
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const [k, v] of Object.entries(limitEnv)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('auth endpointlari qattiq cheklanadi (429)', async () => {
    const server = app.getHttpServer();
    const login = () => request(server).post('/auth/login').send({ email: 'yoq-rl@e2e.uz', password: 'xato-parol' });
    for (let i = 0; i < 3; i++) await login().expect(401);
    const res = await login().expect(429);
    expect(res.headers['retry-after-auth']).toBeDefined();
    // Hisob endpoint (route) va IP bo'yicha alohida: refresh o'z chegarasiga ega
    const refresh = () => request(server).post('/auth/refresh').send({ refreshToken: 'x'.repeat(20) });
    for (let i = 0; i < 3; i++) await refresh().expect(401);
    await refresh().expect(429);
  });

  it('umumiy REST alohida hisoblanadi; /health cheklanmaydi', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 6; i++) await request(server).get('/auth/me').expect(401);
    await request(server).get('/auth/me').expect(429);
    for (let i = 0; i < 10; i++) await request(server).get('/health').expect(200);
  });
});
