import { z } from 'zod';
import { PublicUserSchema } from './schemas.js';

// 1:1 ovozli/video qo'ng'iroqlar (WebRTC). Signal — Socket.IO orqali, media —
// to'g'ridan-to'g'ri (P2P) yoki TURN orqali. Kontrakt API, veb va mobil uchun bitta.
//
// Oqim: chaqiruvchi `call:invite` (callId'ni o'zi yaratadi) → qabul qiluvchining
// hamma qurilmalariga `call:invite` → qurilma `call:ringing` → chaqiruvchiga
// `call:ringing`. Qabul: `call:accept` → chaqiruvchi `call:offer` → `call:answer`,
// ikki tomon `call:ice`. Tugash: `call:reject` / `call:cancel` / `call:end` —
// server ikkala tomonga `call:end` (sababi bilan) yuboradi. Band bo'lsa `call:busy`.
//
// Tiklash: qabul qilingan qo'ng'iroqda signal socket'i uzilsa, server qo'ng'iroqni
// `CALL_RESUME_GRACE_MS` kutadi. Yangi socket `call:resume` (ack) yuboradi — faqat
// qo'ng'iroq ishtirokchisi; server socket'ni qayta bog'laydi va suhbatdoshga `call:resume`
// yuboradi. Keyin chaqiruvchi (offer beruvchi) ICE restart offer'ini yuboradi.

export const CallMediaSchema = z.enum(['audio', 'video']);
export type CallMedia = z.infer<typeof CallMediaSchema>;

/**
 * Qo'ng'iroq nega tugadi:
 * `hangup` — gaplashib bo'lingach biri tugatdi; `rejected` — qabul qiluvchi rad etdi;
 * `cancelled` — chaqiruvchi javobni kutmay bekor qildi; `missed` — javob bo'lmadi (timeout);
 * `busy` — qabul qiluvchi boshqa qo'ng'iroqda; `disconnected` — ishtirokchining ulanishi uzildi;
 * `answered_elsewhere` — boshqa qurilmada qabul qilindi (shu qurilma jiringlashni to'xtatadi).
 */
export const CallEndReasonSchema = z.enum([
  'hangup',
  'rejected',
  'cancelled',
  'missed',
  'busy',
  'disconnected',
  'answered_elsewhere',
]);
export type CallEndReason = z.infer<typeof CallEndReasonSchema>;

/** SDP (offer/answer). Video SDP odatda 5–15 KB; chegara zaxira bilan. */
export const CallSdpSchema = z.object({
  type: z.enum(['offer', 'answer']),
  sdp:  z.string().min(1).max(100_000),
});
export type CallSdp = z.infer<typeof CallSdpSchema>;

/** `RTCIceCandidateInit` ning JSON ko'rinishi. */
export const CallIceCandidateSchema = z.object({
  candidate:        z.string().max(2048),
  sdpMid:           z.string().max(64).nullable().optional(),
  sdpMLineIndex:    z.number().int().min(0).max(255).nullable().optional(),
  usernameFragment: z.string().max(256).nullable().optional(),
});
export type CallIceCandidate = z.infer<typeof CallIceCandidateSchema>;

const callId = z.uuid();

// --- mijoz → server ---
export const WsCallInviteSchema = z.object({
  /** Mijoz yaratadi (UUID) — ack kelmasdan oldin kelgan voqealarni ham shu bilan taniydi. */
  callId,
  chatId: z.uuid(),
  media:  CallMediaSchema,
});
export type WsCallInvite = z.infer<typeof WsCallInviteSchema>;

/** `call:ringing` / `call:accept` / `call:reject` / `call:cancel` / `call:end`. */
export const WsCallRefSchema = z.object({ callId });
export type WsCallRef = z.infer<typeof WsCallRefSchema>;

export const WsCallSdpSchema = z.object({ callId, description: CallSdpSchema });
export type WsCallSdp = z.infer<typeof WsCallSdpSchema>;

export const WsCallIceSchema = z.object({
  callId,
  /** `null` — nomzodlar tugadi (end-of-candidates). */
  candidate: CallIceCandidateSchema.nullable(),
});
export type WsCallIce = z.infer<typeof WsCallIceSchema>;

/** `call:resume` ack'i: suhbatdosh signal kanaliga hozir ulanganmi (ICE restart'ni kim boshlashini hal qiladi). */
export const WsCallResumedSchema = z.object({ callId, peerConnected: z.boolean() });
export type WsCallResumed = z.infer<typeof WsCallResumedSchema>;

// --- server → mijoz ---
/** Kiruvchi qo'ng'iroq (qabul qiluvchining hamma qurilmalariga). */
export const WsCallIncomingSchema = z.object({
  callId,
  chatId:    z.uuid(),
  media:     CallMediaSchema,
  from:      PublicUserSchema,
  createdAt: z.iso.datetime({ offset: true }),
});
export type WsCallIncoming = z.infer<typeof WsCallIncomingSchema>;

export const WsCallEndedSchema = z.object({
  callId,
  reason:     CallEndReasonSchema,
  /** Qabul qilingandan tugaguncha (server vaqti), qabul qilinmagan bo'lsa `null`. */
  durationMs: z.number().int().min(0).nullable(),
});
export type WsCallEnded = z.infer<typeof WsCallEndedSchema>;

// --- ICE serverlar (`GET /calls/ice-servers`) ---
export const IceServerSchema = z.object({
  urls:       z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  username:   z.string().optional(),
  credential: z.string().optional(),
});
export type IceServer = z.infer<typeof IceServerSchema>;

export const IceServersResponseSchema = z.object({
  iceServers: z.array(IceServerSchema),
  /** TURN vaqtinchalik credential muddati (soniya); TURN yo'q yoki doimiy bo'lsa `null`. */
  ttlSeconds: z.number().int().min(1).nullable(),
});
export type IceServersResponse = z.infer<typeof IceServersResponseSchema>;

/** Qo'ng'iroq qancha jiringlaydi (javob bo'lmasa `missed`). */
export const CALL_RING_TIMEOUT_MS = 45_000;

/**
 * Qabul qilingan qo'ng'iroqda signal socket'i uzilsa, server qo'ng'iroqni shuncha kutadi
 * (`call:resume` bilan qayta ulanish uchun); o'tsa `disconnected` bilan tugaydi.
 */
export const CALL_RESUME_GRACE_MS = 15_000;

/** `3:12`, `1:02:05` — davomiylik (millisekund) qo'ng'iroq formatida. */
export const formatCallDuration = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

/**
 * Qo'ng'iroq tugaganda chatga yoziladigan tizim xabari matni.
 * Gaplashilgan bo'lsa — davomiylik bilan; bo'lmasa — natija.
 */
export const callSummaryText = (media: CallMedia, reason: CallEndReason, durationMs: number | null): string => {
  const icon = media === 'video' ? '🎥' : '📞';
  const kind = media === 'video' ? 'Video qo\'ng\'iroq' : 'Qo\'ng\'iroq';
  if (durationMs !== null) return `${icon} ${kind}, ${formatCallDuration(durationMs)}`;
  const noun = media === 'video' ? 'video qo\'ng\'iroq' : 'qo\'ng\'iroq';
  if (reason === 'rejected') return `${icon} Rad etilgan ${noun}`;
  if (reason === 'cancelled') return `${icon} Bekor qilingan ${noun}`;
  return `${icon} Javobsiz ${noun}`;
};
