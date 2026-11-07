import type { Request } from 'express';
import type { Socket } from 'socket.io';

export interface ClientContext {
  ip:        string | null;
  userAgent: string | null;
}

const first = (v: string | string[] | undefined): string | null => (Array.isArray(v) ? v[0] : v)?.trim() || null;

/** HTTP: `req.ip` (Express `trust proxy` — `TRUST_PROXY` — bo'yicha haqiqiy IP). */
export const httpContext = (req: Pick<Request, 'ip' | 'headers'>): ClientContext => ({
  ip:        req.ip ?? null,
  userAgent: first(req.headers['user-agent']),
});

/** WebSocket: proksi ortida `X-Forwarded-For` faqat `TRUST_PROXY` berilgan bo'lsa ishonchli. */
export const socketContext = (socket: Pick<Socket, 'handshake'>): ClientContext => {
  const { headers, address } = socket.handshake;
  const forwarded = process.env.TRUST_PROXY ? first(headers['x-forwarded-for'])?.split(',')[0]?.trim() : null;
  return { ip: forwarded || address || null, userAgent: first(headers['user-agent']) };
};
