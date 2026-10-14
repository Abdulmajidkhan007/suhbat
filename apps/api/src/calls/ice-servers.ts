import { createHmac } from 'node:crypto';
import type { IceServer, IceServersResponse } from '@suhbat/core';

export const DEFAULT_STUN_URLS = ['stun:stun.l.google.com:19302'];
/** TURN vaqtinchalik credential muddati (soniya), `TURN_TTL_SECONDS` bo'lmasa. */
export const DEFAULT_TURN_TTL_SECONDS = 12 * 3600;

export interface IceConfig {
  stunUrls:       string[];
  turnUrls:       string[];
  /** Doimiy credential (Cloudflare/metered.ca kabi xizmat bergan). */
  turnUsername:   string | null;
  turnCredential: string | null;
  /** coturn `use-auth-secret` / `static-auth-secret` — vaqtinchalik credential yasash uchun. */
  turnSecret:     string | null;
  turnTtlSeconds: number;
}

const list = (raw: string | undefined): string[] =>
  (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const text = (raw: string | undefined): string | null => raw?.trim() || null;

/**
 * Env'dan: `STUN_URLS` (ko'rsatilmasa Google STUN; bo'sh satr — STUN yo'q),
 * `TURN_URLS`, `TURN_USERNAME` + `TURN_CREDENTIAL` yoki `TURN_SECRET`, `TURN_TTL_SECONDS`.
 */
export const readIceConfig = (get: (key: string) => string | undefined): IceConfig => {
  const stun = get('STUN_URLS');
  const ttl = Number(get('TURN_TTL_SECONDS'));
  return {
    stunUrls:       stun === undefined ? DEFAULT_STUN_URLS : list(stun),
    turnUrls:       list(get('TURN_URLS')),
    turnUsername:   text(get('TURN_USERNAME')),
    turnCredential: text(get('TURN_CREDENTIAL')),
    turnSecret:     text(get('TURN_SECRET')),
    turnTtlSeconds: Number.isInteger(ttl) && ttl > 0 ? ttl : DEFAULT_TURN_TTL_SECONDS,
  };
};

/**
 * coturn "TURN REST API" credential: `username = <tugash unix vaqti>:<userId>`,
 * `credential = base64(HMAC-SHA1(secret, username))`. coturn shu secret bilan tekshiradi.
 */
export const turnRestCredential = (secret: string, userId: string, ttlSeconds: number, nowMs: number) => {
  const username = `${Math.floor(nowMs / 1000) + ttlSeconds}:${userId}`;
  const credential = createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential };
};

/** Foydalanuvchi uchun ICE serverlar ro'yxati. `TURN_SECRET` bo'lsa u doimiy credential'dan ustun. */
export const buildIceServers = (config: IceConfig, userId: string, nowMs = Date.now()): IceServersResponse => {
  const iceServers: IceServer[] = [];
  if (config.stunUrls.length > 0) iceServers.push({ urls: config.stunUrls });
  if (config.turnUrls.length === 0) return { iceServers, ttlSeconds: null };
  if (config.turnSecret) {
    const cred = turnRestCredential(config.turnSecret, userId, config.turnTtlSeconds, nowMs);
    iceServers.push({ urls: config.turnUrls, ...cred });
    return { iceServers, ttlSeconds: config.turnTtlSeconds };
  }
  if (config.turnUsername && config.turnCredential) {
    iceServers.push({ urls: config.turnUrls, username: config.turnUsername, credential: config.turnCredential });
  } else {
    iceServers.push({ urls: config.turnUrls });
  }
  return { iceServers, ttlSeconds: null };
};
