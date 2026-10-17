import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';

export interface MailMessage {
  to:      string;
  subject: string;
  html:    string;
  text:    string;
}

/**
 * Email yuborish abstraktsiyasi (DI tokeni sifatida ham). Realizatsiyalar:
 * Resend HTTP API, SMTP (nodemailer) va o'chiq (kalit yo'q).
 */
export abstract class Mailer {
  /** `false` — sozlanmagan: `send` chaqirilmasligi kerak. */
  abstract readonly configured: boolean;
  /** Provayder nomi (log uchun). */
  abstract readonly provider: string;
  abstract send(message: MailMessage): Promise<void>;
}

export class DisabledMailer extends Mailer {
  readonly configured = false;
  readonly provider = 'none';
  send(): Promise<void> {
    return Promise.reject(new Error('Email yuborish sozlanmagan'));
  }
}

export const RESEND_API_URL = 'https://api.resend.com/emails';

/** https://resend.com/docs/api-reference/emails/send-email */
export class ResendMailer extends Mailer {
  readonly configured = true;
  readonly provider = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly doFetch: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    super();
  }

  async send(m: MailMessage): Promise<void> {
    const res = await this.doFetch(RESEND_API_URL, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from: this.from, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Javob tanasida kalit bo'lmaydi; qisqartirib logga beriladi.
      const body = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`Resend ${res.status}: ${body}`);
    }
  }
}

/** Nodemailer standarti 2 daqiqa — bloklangan portda xato tez ko'rinsin. URL'da berilsa o'shanisi. */
export const SMTP_TIMEOUTS = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000 } as const;

/** Tarmoq darajasidagi xatolar: odatda hosting chiquvchi SMTP portini yopgan. */
const NETWORK_ERRORS = new Set(['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH']);

export const withSmtpTimeouts = (url: string): string => {
  try {
    const parsed = new URL(url);
    for (const [key, value] of Object.entries(SMTP_TIMEOUTS)) {
      if (!parsed.searchParams.has(key)) parsed.searchParams.set(key, String(value));
    }
    return parsed.toString();
  } catch {
    return url; // nodemailer o'zi xato beradi
  }
};

export class SmtpMailer extends Mailer {
  readonly configured = true;
  readonly provider = 'smtp';
  private readonly transport: ReturnType<typeof createTransport>;

  constructor(url: string, private readonly from: string) {
    super();
    this.transport = createTransport(withSmtpTimeouts(url));
  }

  async send(m: MailMessage): Promise<void> {
    try {
      await this.transport.sendMail({ from: this.from, to: m.to, subject: m.subject, html: m.html, text: m.text });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code && NETWORK_ERRORS.has(code)) {
        throw new Error(
          `SMTP serverga ulanib bo'lmadi (${code}). Hosting chiquvchi SMTP portlarini yopgan bo'lishi mumkin ` +
          `(Railway Hobby'da 25/465/587/2525 yopiq) — RESEND_API_KEY ishlating (QADAMLAR.md 14): ${(e as Error).message}`,
        );
      }
      throw e;
    }
  }
}

/**
 * Env bo'yicha tanlaydi: `RESEND_API_KEY` → Resend, aks holda `SMTP_URL` → SMTP.
 * `MAIL_FROM` shart. Hech biri bo'lmasa — o'chiq (API baribir ko'tariladi, logda ogohlantirish).
 */
export const createMailer = (config: ConfigService, logger = new Logger('Mailer')): Mailer => {
  const resendKey = config.get<string>('RESEND_API_KEY')?.trim();
  const smtpUrl = config.get<string>('SMTP_URL')?.trim();
  const from = config.get<string>('MAIL_FROM')?.trim();

  if (!resendKey && !smtpUrl) {
    logger.warn('RESEND_API_KEY / SMTP_URL yo\'q — email yuborish o\'chiq (parolni tiklash 503 qaytaradi)');
    return new DisabledMailer();
  }
  if (!from) {
    logger.warn('MAIL_FROM yo\'q — email yuborish o\'chiq (masalan: MAIL_FROM="Suhbat <noreply@suhbat.uz>")');
    return new DisabledMailer();
  }
  return resendKey ? new ResendMailer(resendKey, from) : new SmtpMailer(smtpUrl!, from);
};
