import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { createMailer, DisabledMailer, RESEND_API_URL, ResendMailer, SmtpMailer } from './mailer';
import { passwordResetMail } from './templates';

const config = (env: Record<string, string>) => ({ get: (k: string) => env[k] }) as unknown as ConfigService;
const logger = () => ({ warn: vi.fn() }) as unknown as import('@nestjs/common').Logger;

describe('createMailer', () => {
  it('kalit yo\'q — o\'chiq, ogohlantirish', () => {
    const log = logger();
    const m = createMailer(config({}), log);
    expect(m).toBeInstanceOf(DisabledMailer);
    expect(m.configured).toBe(false);
    expect(log.warn).toHaveBeenCalled();
  });

  it('MAIL_FROM yo\'q — o\'chiq', () => {
    expect(createMailer(config({ RESEND_API_KEY: 're_x' }), logger()).configured).toBe(false);
  });

  it('Resend ustun, aks holda SMTP', () => {
    expect(createMailer(config({ RESEND_API_KEY: 're_x', SMTP_URL: 'smtp://a', MAIL_FROM: 'S <a@b.uz>' }), logger()))
      .toBeInstanceOf(ResendMailer);
    expect(createMailer(config({ SMTP_URL: 'smtp://u:p@localhost:2525', MAIL_FROM: 'a@b.uz' }), logger()))
      .toBeInstanceOf(SmtpMailer);
  });

  it('DisabledMailer.send rad etadi', async () => {
    await expect(new DisabledMailer().send()).rejects.toThrow('sozlanmagan');
  });
});

describe('ResendMailer', () => {
  const message = { to: 'ali@b.uz', subject: 'S', html: '<p>h</p>', text: 't' };

  it('Resend API\'ga to\'g\'ri so\'rov yuboradi', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'e1' }), { status: 200 }));
    await new ResendMailer('re_key', 'Suhbat <noreply@suhbat.uz>', fetch as unknown as typeof globalThis.fetch).send(message);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RESEND_API_URL);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_key');
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'Suhbat <noreply@suhbat.uz>', to: ['ali@b.uz'], subject: 'S', html: '<p>h</p>', text: 't',
    });
  });

  it('xato javob — istisno (status va qisqa matn bilan, kalitsiz)', async () => {
    const fetch = vi.fn(async () => new Response('{"name":"validation_error","message":"bad from"}', { status: 422 }));
    const err = await new ResendMailer('re_secret', 'a@b.uz', fetch as unknown as typeof globalThis.fetch).send(message).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('422');
    expect((err as Error).message).not.toContain('re_secret');
  });
});

describe('passwordResetMail', () => {
  it('o\'zbekcha matn, havola, ismni HTML\'da ekranlaydi', () => {
    const m = passwordResetMail({ to: 'a@b.uz', displayName: '<b>Ali</b>', link: 'https://suhbat.uz/reset-password?token=abc', ttlMinutes: 30 });
    expect(m.subject).toContain('parolni tiklash');
    expect(m.text).toContain('https://suhbat.uz/reset-password?token=abc');
    expect(m.text).toContain('30 daqiqa');
    expect(m.html).toContain('href="https://suhbat.uz/reset-password?token=abc"');
    expect(m.html).not.toContain('<b>Ali</b>');
    expect(m.html).toContain('&lt;b&gt;Ali&lt;/b&gt;');
  });
});
