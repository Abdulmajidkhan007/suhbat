// Username va parolni tiklash (haqiqiy Postgres). Email — soxta `Mailer` (xatlar xotirada).
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { DisabledMailer, Mailer } from '../src/mail/mailer';
import type { MailMessage } from '../src/mail/mailer';
import { PrismaService } from '../src/prisma/prisma.service';

class MemoryMailer extends Mailer {
  readonly configured = true;
  readonly provider = 'memory';
  sent: MailMessage[] = [];
  async send(m: MailMessage) {
    this.sent.push(m);
  }
}

const stamp = Date.now().toString(36);
const emailOf = (n: string) => `${n}-${stamp}@reset.e2e.uz`;
const WEB_URL = 'https://web.e2e.suhbat.uz';

const withEnv = async <T>(env: Record<string, string>, fn: () => Promise<T>): Promise<T> => {
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

const createApp = (mailer: Mailer, env: Record<string, string> = {}) =>
  withEnv({ WEB_URL, ...env }, async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Mailer).useValue(mailer).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    return app;
  });

const tokenFrom = (m: MailMessage) => {
  const match = /\/reset-password\?token=([\w-]+)/.exec(m.text);
  if (!match) throw new Error('xatda havola yo\'q');
  return match[1];
};

describe('username va parolni tiklash (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const mailer = new MemoryMailer();
  const server = () => app.getHttpServer();
  const uname = `ali_${stamp}`;

  const register = (n: string, extra: Record<string, unknown> = {}) =>
    request(server()).post('/auth/register').send({ email: emailOf(n), password: '12345678', displayName: `${n} ${stamp}`, ...extra });
  const login = (loginId: string, password = '12345678') => request(server()).post('/auth/login').send({ login: loginId, password });
  const forgot = (emailOrUsername: string) => request(server()).post('/auth/forgot-password').send({ emailOrUsername });

  beforeAll(async () => {
    app = await createApp(mailer);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: `-${stamp}@reset.e2e.uz` } } });
    await app.close();
  });

  beforeEach(() => {
    mailer.sent = [];
  });

  describe('username', () => {
    let aliToken: string;

    beforeAll(async () => {
      const res = await register('ali', { username: `@${uname.toUpperCase()}` }).expect(201);
      expect(res.body.user.username).toBe(uname); // normallashtirilgan
      aliToken = res.body.accessToken;
      await register('vali').expect(201); // usernamesiz — ixtiyoriy
    });

    it('unique va katta-kichik harf farqsiz; mavjud email uchun alohida xabar', async () => {
      const dup = await register('ali2', { username: uname.toUpperCase() }).expect(409);
      expect(dup.body.message).toBe('Bu username band');
      expect(await prisma.user.count({ where: { email: emailOf('ali2') } })).toBe(0);
      const dupEmail = await register('ali', { username: `boshqa_${stamp}` }).expect(409);
      expect(dupEmail.body.message).toBe('Bu email bilan hisob mavjud');
      // Baza ham kafolatlaydi: katta harfli username yozib bo'lmaydi (CHECK)
      await expect(prisma.user.update({ where: { email: emailOf('vali') }, data: { username: uname.toUpperCase() } })).rejects.toThrow();
    });

    it('noto\'g\'ri yoki zaxira username ro\'yxatdan o\'tishda — 400', async () => {
      await register('x1', { username: 'ab' }).expect(400);
      await register('x2', { username: 'admin' }).expect(400);
      await register('x3', { username: '1abcde' }).expect(400);
    });

    it('GET /users/username-available (tokensiz)', async () => {
      const check = async (u: string) => (await request(server()).get('/users/username-available').query({ u }).expect(200)).body;
      expect(await check(uname.toUpperCase())).toEqual({ username: uname, available: false, reason: 'Bu username band' });
      expect(await check(`@bosh_${stamp}`)).toEqual({ username: `bosh_${stamp}`, available: true, reason: null });
      expect(await check('admin')).toMatchObject({ available: false, reason: 'Bu username band qilingan' });
      expect((await check('ab')).reason).toContain('kamida 5');
    });

    it('kirish: email YOKI username (@ bilan, katta harf bilan); eski `email` maydoni ham ishlaydi', async () => {
      await login(emailOf('ali').toUpperCase()).expect(200);
      await login(uname).expect(200);
      await login(`@${uname.toUpperCase()}`).expect(200);
      await request(server()).post('/auth/login').send({ email: emailOf('ali'), password: '12345678' }).expect(200);
      const bad = await login(uname, 'xato-parol').expect(401);
      expect(bad.body.message).toBe('Login yoki parol noto\'g\'ri');
      await login(`yoq_${stamp}`).expect(401);
    });

    it('qidiruv: @username aniq moslik; PublicUser\'da username bor, email yo\'q', async () => {
      const vali = (await login(emailOf('vali')).expect(200)).body.accessToken as string;
      const search = async (q: string) =>
        (await request(server()).get('/users/search').query({ q }).set('Authorization', `Bearer ${vali}`).expect(200)).body as Record<string, unknown>[];
      const exact = await search(`@${uname.toUpperCase()}`);
      expect(exact.map((u) => u.username)).toEqual([uname]);
      expect(exact[0]).not.toHaveProperty('email');
      expect(Object.keys(exact[0]).sort()).toEqual(['bio', 'createdAt', 'displayName', 'id', 'photoUrl', 'username']);
      expect(await search(`@${uname.slice(0, -2)}`)).toEqual([]); // qism — topilmaydi
      expect((await search(uname)).map((u) => u.username)).toEqual([uname]); // @siz ham aniq moslik
    });

    it('profilda username o\'zgartirish, band — 409, o\'chirish — null', async () => {
      const patch = (body: Record<string, unknown>, token = aliToken) =>
        request(server()).patch('/users/me').set('Authorization', `Bearer ${token}`).send(body);
      const next = `ali_yangi_${stamp}`;
      expect((await patch({ username: next.toUpperCase() }).expect(200)).body.username).toBe(next);
      await login(next).expect(200);
      await login(uname).expect(401); // eski username endi bo'sh

      const vali = (await login(emailOf('vali')).expect(200)).body.accessToken as string;
      expect((await patch({ username: next }, vali).expect(409)).body.message).toBe('Bu username band');
      await patch({ username: 'admin' }, vali).expect(400);
      expect((await patch({ username: null }).expect(200)).body.username).toBeNull();
      expect((await patch({ username: uname }).expect(200)).body.username).toBe(uname);
    });
  });

  describe('parolni tiklash', () => {
    beforeAll(async () => {
      await register('gani', { username: `gani_${stamp}` }).expect(201);
      await register('olim').expect(201);
    });

    it('forgot-password: bor va yo\'q hisob uchun javob bir xil; xat faqat borga', async () => {
      const a = await forgot(emailOf('gani')).expect(200);
      const b = await forgot(emailOf('hechkim')).expect(200);
      const c = await forgot(`@gani_${stamp}`).expect(200);
      const d = await forgot(`yoq_${stamp}`).expect(200);
      expect(b.body).toEqual(a.body);
      expect(c.body).toEqual(a.body);
      expect(d.body).toEqual(a.body);
      expect(a.body.message).toContain('Agar bunday hisob bo\'lsa');
      expect(mailer.sent.map((m) => m.to)).toEqual([emailOf('gani'), emailOf('gani')]);
      expect(mailer.sent[0].text).toContain(`${WEB_URL}/reset-password?token=`);
      // Bazada xom token yo'q — faqat hash
      const token = tokenFrom(mailer.sent[1]);
      const rows = await prisma.passwordResetToken.findMany({ where: { user: { email: emailOf('gani') } } });
      expect(rows.some((r) => r.tokenHash.includes(token))).toBe(false);
      await forgot('').expect(400);
    });

    it('reset: parol yangilanadi, token bir martalik, barcha sessiyalar yopiladi', async () => {
      // Ikki qurilmada sessiya
      const s1 = (await login(emailOf('olim')).expect(200)).body as { refreshToken: string };
      const s2 = (await login(emailOf('olim')).expect(200)).body as { refreshToken: string };
      await forgot(emailOf('olim')).expect(200);
      const token = tokenFrom(mailer.sent[0]);

      await request(server()).post('/auth/reset-password').send({ token, newPassword: '123' }).expect(400); // qisqa parol
      await request(server()).post('/auth/reset-password').send({ token, newPassword: 'yangi-parol-77' }).expect(204);
      const again = await request(server()).post('/auth/reset-password').send({ token, newPassword: 'boshqa-parol-88' }).expect(400);
      expect(again.body.message).toContain('yaroqsiz');

      await login(emailOf('olim')).expect(401);
      await login(emailOf('olim'), 'yangi-parol-77').expect(200);
      await login(emailOf('olim'), 'boshqa-parol-88').expect(401);
      // Eski refresh tokenlar (ikkala qurilma) endi ishlamaydi
      await request(server()).post('/auth/refresh').send({ refreshToken: s1.refreshToken }).expect(401);
      await request(server()).post('/auth/refresh').send({ refreshToken: s2.refreshToken }).expect(401);
    });

    it('yangi so\'rov eski havolani bekor qiladi', async () => {
      await forgot(emailOf('gani')).expect(200);
      await forgot(emailOf('gani')).expect(200);
      const [first, second] = mailer.sent.map(tokenFrom);
      await request(server()).post('/auth/reset-password').send({ token: first, newPassword: 'gani-parol-1' }).expect(400);
      await request(server()).post('/auth/reset-password').send({ token: second, newPassword: 'gani-parol-1' }).expect(204);
      await login(`gani_${stamp}`, 'gani-parol-1').expect(200);
    });

    it('muddati o\'tgan token — 400', async () => {
      await prisma.passwordResetToken.deleteMany({ where: { user: { email: emailOf('gani') } } }); // hisob limiti uchun
      await forgot(emailOf('gani')).expect(200);
      const token = tokenFrom(mailer.sent[0]);
      await prisma.passwordResetToken.updateMany({
        where: { user: { email: emailOf('gani') }, usedAt: null },
        data:  { expiresAt: new Date(Date.now() - 1000) },
      });
      await request(server()).post('/auth/reset-password').send({ token, newPassword: 'gani-parol-2' }).expect(400);
      await login(`gani_${stamp}`, 'gani-parol-1').expect(200); // parol o'zgarmadi
    });

    it('noma\'lum token — 400', async () => {
      await request(server()).post('/auth/reset-password').send({ token: 'x'.repeat(43), newPassword: 'gani-parol-3' }).expect(400);
    });
  });
});

describe('parolni tiklash: cheklovlar va sozlanmagan email (e2e)', () => {
  it('IP limiti — 429; hisob limiti — javob o\'zgarmaydi, xat ketmaydi', async () => {
    const mailer = new MemoryMailer();
    const app = await createApp(mailer, { FORGOT_PASSWORD_IP_LIMIT: '5', FORGOT_PASSWORD_ACCOUNT_LIMIT: '2' });
    const prisma = app.get(PrismaService);
    const email = emailOf('limit');
    try {
      await request(app.getHttpServer()).post('/auth/register').send({ email, password: '12345678', displayName: 'Limit' }).expect(201);
      const forgot = () => request(app.getHttpServer()).post('/auth/forgot-password').send({ emailOrUsername: email });
      const bodies = [];
      for (let i = 0; i < 4; i++) bodies.push((await forgot().expect(200)).body);
      expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
      expect(mailer.sent).toHaveLength(2); // hisob limiti: 2
      await forgot().expect(200);
      await forgot().expect(429); // IP limiti: 5
      // Yo'q hisob uchun ham bir xil 429 — limit hisobga bog'liq emas
      await request(app.getHttpServer()).post('/auth/forgot-password').send({ emailOrUsername: emailOf('yoq') }).expect(429);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
      await app.close();
    }
  });

  it('email sozlanmagan — bor va yo\'q hisob uchun bir xil 503', async () => {
    const app = await createApp(new DisabledMailer());
    try {
      const a = await request(app.getHttpServer()).post('/auth/forgot-password').send({ emailOrUsername: emailOf('gani') }).expect(503);
      const b = await request(app.getHttpServer()).post('/auth/forgot-password').send({ emailOrUsername: emailOf('hechkim') }).expect(503);
      expect(a.body).toEqual(b.body);
      expect(a.body.message).toBe('Email yuborish hozircha sozlanmagan');
      await request(app.getHttpServer()).get('/health').expect(200); // API ko'tarilgan
    } finally {
      await app.close();
    }
  });
});
