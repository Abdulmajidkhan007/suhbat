import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PUSH_HIDDEN_BODY, PUSH_HIDDEN_TITLE } from '@suhbat/core';
import type { CallMedia, ChatType, Message, PushCallData, PushMessageData } from '@suhbat/core';
import { PrismaService } from '../prisma/prisma.service';
import { FcmClient } from './fcm.client';
import type { FcmMessage } from './fcm.client';

/** Bitta SQL so'rovdagi `IN (...)` hajmi (katta kanal bo'laklab o'qiladi). */
const QUERY_CHUNK = 1000;
const BODY_MAX = 200;

const chunks = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Xabarning qisqa matni: matn bo'lmasa biriktirma turi. */
export const previewText = (message: Pick<Message, 'type' | 'content'>): string => {
  const text = message.content.trim().replace(/\s+/g, ' ');
  const label = { image: '📷 Rasm', file: '📎 Fayl', voice: '🎤 Ovozli xabar' }[message.type as string];
  if (label) return text ? `${label}: ${truncate(text, BODY_MAX)}` : label;
  return truncate(text, BODY_MAX);
};

/** Kiruvchi qo'ng'iroq bildirishnomasi matni. */
export const callNotificationBody = (media: CallMedia) =>
  media === 'video' ? '🎥 Kiruvchi video qo\'ng\'iroq' : '📞 Kiruvchi qo\'ng\'iroq';

export interface IncomingCallPush {
  callId:     string;
  chatId:     string;
  media:      CallMedia;
  callerName: string;
  calleeId:   string;
  /** Shundan keyin yetkazish ma'nosiz (jiringlash tugagan). */
  ttlSeconds: number;
}

export interface PushContext {
  chatType:   ChatType;
  chatTitle:  string | null;
  senderName: string;
}

/** Preview yoqilgan foydalanuvchi uchun sarlavha/matn (Telegram'dagidek). */
export const buildNotification = (ctx: PushContext, message: Pick<Message, 'type' | 'content'>) => {
  const text = previewText(message);
  if (ctx.chatType === 'direct') return { title: ctx.senderName, body: text };
  if (ctx.chatType === 'channel') return { title: ctx.chatTitle ?? PUSH_HIDDEN_TITLE, body: text };
  return { title: ctx.chatTitle ?? PUSH_HIDDEN_TITLE, body: `${ctx.senderName}: ${text}` };
};

/** Cheklangan parallellik bilan bajaradi (FCM'ga bir vaqtda `limit` tadan ko'p so'rov ketmaydi). */
export const runLimited = async <T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> => {
  let index = 0;
  const worker = async () => {
    while (index < items.length) {
      const item = items[index++] as T;
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
};

/**
 * Yangi xabar haqida push. Chaqiruvchi kutmaydi (`void`), xatolar shu yerda
 * ushlanadi — xabar yuborish javobi hech qachon bloklanmaydi/yiqilmaydi.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly concurrency: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmClient,
    config: ConfigService,
  ) {
    const n = Number(config.get<string>('FCM_CONCURRENCY'));
    this.concurrency = Number.isInteger(n) && n > 0 ? n : 20;
  }

  /** `recipientIds` — onlayn bo'lmagan a'zolar (gateway aniqlaydi). Yuboruvchi va bloklanganlar chiqariladi. */
  async notifyNewMessage(message: Message, recipientIds: string[]): Promise<void> {
    if (!this.fcm.enabled || message.type === 'system') return;
    try {
      await this.deliver(message, recipientIds.filter((id) => id !== message.senderId));
    } catch (e) {
      this.logger.error('push (yangi xabar)', e as Error);
    }
  }

  /**
   * Oflayn qabul qiluvchiga kiruvchi qo'ng'iroq haqida push. `data.type = 'call'` —
   * bosilganda ilova ochiladi, socket ulanadi va server hali jiringlayotgan qo'ng'iroqni
   * (`call:invite`) qayta yuboradi. Ko'rinadigan bildirishnoma bilan (data-only emas):
   * data-only xabarni ilova fonda o'zi ko'rsata olmaydi (notifee/CallKit yo'q).
   */
  async notifyIncomingCall(call: IncomingCallPush): Promise<void> {
    if (!this.fcm.enabled) return;
    try {
      const user = await this.prisma.user.findUnique({
        where:  { id: call.calleeId },
        select: { notificationPreview: true, devices: { select: { token: true } } },
      });
      if (!user || user.devices.length === 0) return;
      const data: PushCallData = { type: 'call', callId: call.callId, chatId: call.chatId, media: call.media };
      const message: FcmMessage = {
        notification: user.notificationPreview
          ? { title: call.callerName, body: callNotificationBody(call.media) }
          : { title: PUSH_HIDDEN_TITLE, body: callNotificationBody(call.media) },
        data,
        threadId:   call.callId,
        channelId:  'calls',
        ttlSeconds: call.ttlSeconds,
      };
      const dead: string[] = [];
      await runLimited(user.devices, this.concurrency, async (d) => {
        if ((await this.fcm.send(d.token, message)) === 'invalid') dead.push(d.token);
      });
      if (dead.length > 0) await this.prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
    } catch (e) {
      this.logger.error('push (qo\'ng\'iroq)', e as Error);
    }
  }

  private async deliver(message: Message, recipientIds: string[]): Promise<void> {
    if (recipientIds.length === 0) return;
    const [chat, sender] = await Promise.all([
      this.prisma.chat.findUnique({ where: { id: message.chatId }, select: { type: true, title: true } }),
      this.prisma.user.findUnique({ where: { id: message.senderId }, select: { displayName: true } }),
    ]);
    if (!chat || !sender) return;

    const shown = buildNotification({ chatType: chat.type, chatTitle: chat.title, senderName: sender.displayName }, message);
    const data: PushMessageData = { type: 'message', chatId: message.chatId, messageId: message.id };
    const payload = (preview: boolean): FcmMessage => ({
      notification: preview ? shown : { title: PUSH_HIDDEN_TITLE, body: PUSH_HIDDEN_BODY },
      data,
      threadId:     message.chatId,
    });
    const withPreview = payload(true);
    const hidden = payload(false);

    let invalid = 0;
    let failed = 0;
    let total = 0;
    // Katta kanal: bo'laklab o'qiladi va yuboriladi — hamma tokenlar xotirada to'planmaydi.
    for (const ids of chunks(recipientIds, QUERY_CHUNK)) {
      const users = await this.prisma.user.findMany({
        where: {
          id:        { in: ids },
          // Ikki tomonlama: yuboruvchini bloklagan yoki yuboruvchi bloklagan foydalanuvchiga push yo'q.
          blocking:  { none: { blockedId: message.senderId } },
          blockedBy: { none: { blockerId: message.senderId } },
          devices:   { some: {} },
        },
        select: { notificationPreview: true, devices: { select: { token: true } } },
      });
      const targets = users.flatMap((u) =>
        u.devices.map((d) => ({ token: d.token, message: u.notificationPreview ? withPreview : hidden })),
      );
      const dead: string[] = [];
      await runLimited(targets, this.concurrency, async (t) => {
        const result = await this.fcm.send(t.token, t.message);
        if (result === 'invalid') dead.push(t.token);
        else if (result === 'error') failed++;
      });
      if (dead.length > 0) await this.prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
      invalid += dead.length;
      total += targets.length;
    }
    if (invalid > 0) this.logger.log(`Yaroqsiz push tokenlar o'chirildi: ${invalid}`);
    if (failed > 0) this.logger.warn(`Push yuborilmadi: ${failed}/${total}`);
  }
}
