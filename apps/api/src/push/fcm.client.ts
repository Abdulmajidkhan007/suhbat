import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'node:crypto';
import { z } from 'zod';

const ServiceAccountSchema = z.object({
  project_id:   z.string().min(1),
  client_email: z.string().min(1),
  private_key:  z.string().min(1),
  token_uri:    z.url().default('https://oauth2.googleapis.com/token'),
});
export type ServiceAccount = z.infer<typeof ServiceAccountSchema>;

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
/** Access token muddati tugashidan shuncha oldin yangilanadi. */
const TOKEN_SKEW_MS = 60_000;

/** FCM HTTP v1 `message` (token bilan). Hamma `data` qiymatlari satr. */
export interface FcmMessage {
  notification: { title: string; body: string };
  data:         Record<string, string>;
  /** Bir chatning bildirishnomalari bitta guruhga (Android `tag`, iOS `thread-id`). */
  threadId:     string;
}

/**
 * `ok` — yuborildi; `invalid` — token endi yaroqsiz (o'chirilishi kerak);
 * `error` — vaqtinchalik yoki boshqa xato (token qoladi).
 */
export type FcmResult = 'ok' | 'invalid' | 'error';

/**
 * `FCM_SERVICE_ACCOUNT_JSON`: service account JSON — xom yoki base64.
 * Yo'q/yaroqsiz bo'lsa `null` (push o'chiq, API baribir ko'tariladi).
 */
export const parseServiceAccount = (raw: string | undefined): ServiceAccount | null => {
  const value = raw?.trim();
  if (!value) return null;
  const json = value.startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('FCM_SERVICE_ACCOUNT_JSON JSON ham, base64 JSON ham emas');
  }
  const result = ServiceAccountSchema.safeParse(parsed);
  if (!result.success) throw new Error('FCM_SERVICE_ACCOUNT_JSON da project_id, client_email yoki private_key yo\'q');
  // Env'ga qo'yilganda qator ko'chishlari ko'pincha `\n` matni bo'lib qoladi.
  return { ...result.data, private_key: result.data.private_key.replace(/\\n/g, '\n') };
};

const base64url = (input: string | Buffer) => Buffer.from(input).toString('base64url');

/** Google OAuth2 uchun RS256 imzolangan JWT (service account → access token). */
export const signAssertion = (account: ServiceAccount, nowMs: number): string => {
  const iat = Math.floor(nowMs / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({ iss: account.client_email, scope: FCM_SCOPE, aud: account.token_uri, iat, exp: iat + 3600 }),
  );
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.private_key);
  return `${header}.${claims}.${base64url(signature)}`;
};

const FcmErrorSchema = z.object({
  error: z.object({
    status:  z.string().optional(),
    message: z.string().optional(),
    details: z.array(z.object({ errorCode: z.string().optional() }).loose()).optional(),
  }),
});

/** FCM javobidan token yaroqsizligini aniqlaydi (UNREGISTERED / 404 / boshqa loyiha tokeni / buzuq token). */
export const classifyFcmError = (status: number, body: unknown): FcmResult => {
  if (status === 404) return 'invalid';
  const parsed = FcmErrorSchema.safeParse(body);
  const codes = parsed.success ? (parsed.data.error.details ?? []).map((d) => d.errorCode) : [];
  if (codes.includes('UNREGISTERED') || codes.includes('SENDER_ID_MISMATCH')) return 'invalid';
  const message = parsed.success ? (parsed.data.error.message ?? '') : '';
  if (status === 400 && codes.includes('INVALID_ARGUMENT') && /registration token/i.test(message)) return 'invalid';
  return 'error';
};

const TokenResponseSchema = z.object({ access_token: z.string(), expires_in: z.number() });

/**
 * FCM HTTP v1 mijozi (Android, iOS — APNs FCM orqali, veb). Kutubxonasiz:
 * service account kaliti bilan JWT imzolanadi, OAuth2 access token keshlanadi.
 */
@Injectable()
export class FcmClient {
  private readonly logger = new Logger(FcmClient.name);
  private readonly account: ServiceAccount | null;
  private accessToken: { value: string; expiresAt: number } | null = null;
  private pendingToken: Promise<string> | null = null;

  constructor(config: ConfigService) {
    let account: ServiceAccount | null = null;
    try {
      account = parseServiceAccount(config.get<string>('FCM_SERVICE_ACCOUNT_JSON'));
      if (!account) this.logger.warn('FCM_SERVICE_ACCOUNT_JSON yo\'q — push bildirishnomalar o\'chiq');
    } catch (e) {
      this.logger.error(`Push o'chiq: ${(e as Error).message}`);
    }
    this.account = account;
  }

  get enabled(): boolean {
    return this.account !== null;
  }

  async send(token: string, message: FcmMessage): Promise<FcmResult> {
    const account = this.account;
    if (!account) return 'error';
    const body = JSON.stringify({
      message: {
        token,
        notification: message.notification,
        data:         message.data,
        android:      {
          priority:     'HIGH',
          notification: { channel_id: 'messages', tag: message.threadId, sound: 'default' },
        },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: { aps: { 'sound': 'default', 'thread-id': message.threadId } },
        },
      },
    });
    const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`;
    try {
      let res = await this.post(url, body, await this.getAccessToken(account));
      if (res.status === 401) {
        // Token muddatidan oldin bekor qilingan bo'lishi mumkin — bir marta yangilab qayta urinamiz.
        this.accessToken = null;
        res = await this.post(url, body, await this.getAccessToken(account));
      }
      if (res.ok) return 'ok';
      const result = classifyFcmError(res.status, await res.json().catch(() => null));
      if (result === 'error') this.logger.warn(`FCM xatosi: HTTP ${res.status}`);
      return result;
    } catch (e) {
      this.logger.warn(`FCM so'rovi bajarilmadi: ${(e as Error).message}`);
      return 'error';
    }
  }

  private post(url: string, body: string, accessToken: string): Promise<Response> {
    return fetch(url, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body,
      signal:  AbortSignal.timeout(10_000),
    });
  }

  /** Keshdagi access token; tugayotgan bo'lsa bitta so'rov bilan yangilanadi (single-flight). */
  private async getAccessToken(account: ServiceAccount): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt - TOKEN_SKEW_MS > Date.now()) return this.accessToken.value;
    this.pendingToken ??= this.fetchAccessToken(account).finally(() => {
      this.pendingToken = null;
    });
    return this.pendingToken;
  }

  private async fetchAccessToken(account: ServiceAccount): Promise<string> {
    const res = await fetch(account.token_uri, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion:  signAssertion(account, Date.now()),
      }),
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`OAuth token olinmadi: HTTP ${res.status}`);
    const parsed = TokenResponseSchema.parse(await res.json());
    this.accessToken = { value: parsed.access_token, expiresAt: Date.now() + parsed.expires_in * 1000 };
    return parsed.access_token;
  }
}
