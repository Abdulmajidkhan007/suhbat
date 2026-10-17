import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { createMailer, DisabledMailer, RESEND_API_URL, ResendMailer, SMTP_TIMEOUTS, SmtpMailer, withSmtpTimeouts } from './mailer';
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

describe('SmtpMailer', () => {
  it('URL\'ga qisqa timeout\'lar qo\'shiladi (berilganlari saqlanadi)', () => {
    const url = new URL(withSmtpTimeouts('smtps://u%40gmail.com:p@smtp.gmail.com:465?connectionTimeout=5000'));
    expect(url.searchParams.get('connectionTimeout')).toBe('5000');
    expect(url.searchParams.get('greetingTimeout')).toBe(String(SMTP_TIMEOUTS.greetingTimeout));
    expect(url.username).toBe('u%40gmail.com');
    expect(withSmtpTimeouts('not a url')).toBe('not a url');
  });

  it('port yopiq bo\'lsa tez va tushunarli xato', async () => {
    const mailer = new SmtpMailer('smtp://u:p@127.0.0.1:1?connectionTimeout=500', 'S <a@b.uz>');
    await expect(mailer.send({ to: 'x@y.uz', subject: 's', html: 'h', text: 't' })).rejects.toThrow(/SMTP serverga ulanib bo'lmadi .*RESEND_API_KEY/);
  });
});
