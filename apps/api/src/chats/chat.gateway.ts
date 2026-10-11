import { HttpException, Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  WS_UNAUTHORIZED,
  WsDeleteMessageSchema,
  WsEditMessageSchema,
  WsEvent,
  WsMarkReadSchema,
  WsSendMessageSchema,
  WsTypingSchema,
} from '@suhbat/core';
import type {
  ClientToServerEvents,
  Message,
  ServerToClientEvents,
  WsAck,
  WsChatUpdated,
} from '@suhbat/core';
import type { Server, Socket } from 'socket.io';
import type { ZodType } from 'zod';
import type { JwtPayload } from '../auth/auth.service';
import { ChatsService } from './chats.service';
import type { MemberChange } from './chats.service';
import { PresenceService } from './presence.service';

interface SocketData {
  userId: string;
  /** Access tokenning tugash vaqti (UNIX soniya); ulanish shu paytda uziladi. */
  exp?:   number;
}
type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const userRoom = (userId: string) => `user:${userId}`;
const rooms = (ids: string[]) => ids.map(userRoom);

/** `setTimeout` chegarasi (~24.8 kun); undan uzoq tokenlar uchun taymer qayta quriladi. */
const MAX_TIMER_MS = 2 ** 31 - 1;

const errorText = (e: unknown): string => {
  if (e instanceof HttpException) return e.message;
  return 'Kutilmagan xato';
};

/**
 * Real vaqt: xabar, "yozmoqda", o'qildi, onlayn. Har socket `user:<id>`
 * xonasiga qo'shiladi; voqealar chat a'zolarining xonalariga yuboriladi.
 * CORS — `main.ts` dagi adapterda (`CORS_ORIGIN`).
 */
@WebSocketGateway()
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(ChatGateway.name);
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();

  @WebSocketServer() server!: ChatServer;

  constructor(
    private readonly jwt: JwtService,
    private readonly chats: ChatsService,
    private readonly presence: PresenceService,
  ) {}

  afterInit(server: ChatServer) {
    server.use((socket, next) => {
      const token: unknown = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) return next(new Error(WS_UNAUTHORIZED));
      this.jwt
        .verifyAsync<JwtPayload>(token)
        .then((payload) => {
          socket.data.userId = payload.sub;
          socket.data.exp = payload.exp;
          next();
        })
        .catch(() => next(new Error(WS_UNAUTHORIZED)));
    });
  }

  async handleConnection(socket: ChatSocket) {
    const { userId } = socket.data;
    if (!userId) return socket.disconnect(true);
    this.scheduleExpiry(socket);
    await socket.join(userRoom(userId));
    const first = this.presence.connect(userId, socket.id);
    try {
      const contacts = await this.chats.contactIds(userId);
      socket.emit(WsEvent.PresenceState, { online: contacts.filter((id) => this.presence.isOnline(id)) });
      if (first && contacts.length > 0) {
        this.server
          .to(contacts.map(userRoom))
          .emit(WsEvent.PresenceUpdate, { userId, online: true, lastSeenAt: null });
      }
    } catch (e) {
      this.logger.error('presence (connect)', e as Error);
    }
  }

  onModuleDestroy() {
    this.expiryTimers.forEach((t) => clearTimeout(t));
    this.expiryTimers.clear();
  }

  async handleDisconnect(socket: ChatSocket) {
    this.clearExpiry(socket);
    const { userId } = socket.data;
    if (!userId || !this.presence.disconnect(userId, socket.id)) return;
    try {
      const at = new Date();
      await this.chats.touchLastSeen(userId, at);
      const contacts = await this.chats.contactIds(userId);
      if (contacts.length > 0) {
        this.server
          .to(contacts.map(userRoom))
          .emit(WsEvent.PresenceUpdate, { userId, online: false, lastSeenAt: at.toISOString() });
      }
    } catch (e) {
      this.logger.error('presence (disconnect)', e as Error);
    }
  }

  @SubscribeMessage(WsEvent.MessageSend)
  async onSend(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): Promise<WsAck<Message>> {
    return this.handle(WsSendMessageSchema, body, async (p) => {
      const { message, memberIds } = await this.chats.sendMessage(
        p.chatId,
        socket.data.userId,
        p.content,
        p.attachmentId,
      );
      this.emitMessageNew(message, memberIds, p.clientId);
      return message;
    });
  }

  @SubscribeMessage(WsEvent.MessageEdit)
  async onEdit(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): Promise<WsAck<Message>> {
    return this.handle(WsEditMessageSchema, body, async (p) => {
      const { message, memberIds } = await this.chats.editMessage(p.chatId, socket.data.userId, p.messageId, p.content);
      this.emitMessageUpdated(message, memberIds);
      return message;
    });
  }

  @SubscribeMessage(WsEvent.MessageDelete)
  async onDelete(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: unknown,
  ): Promise<WsAck<{ deletedAt: string }>> {
    return this.handle(WsDeleteMessageSchema, body, async (p) => {
      const { deletedAt, memberIds } = await this.chats.deleteMessage(p.chatId, socket.data.userId, p.messageId);
      this.emitMessageDeleted(p.chatId, p.messageId, deletedAt, memberIds);
      return { deletedAt };
    });
  }

  @SubscribeMessage(WsEvent.Typing)
  async onTyping(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): Promise<void> {
    const parsed = WsTypingSchema.safeParse(body);
    if (!parsed.success) return;
    const { userId } = socket.data;
    try {
      const access = await this.chats.access(parsed.data.chatId, userId);
      if (access.type === 'channel') return; // minglab obunachiga "yozmoqda" yuborilmaydi
      const others = access.memberIds.filter((id) => id !== userId);
      if (others.length > 0) {
        this.server.to(rooms(others)).emit('typing', { ...parsed.data, userId });
      }
    } catch {
      // a'zo emas — jim e'tiborsiz qoldiriladi
    }
  }

  @SubscribeMessage(WsEvent.MessageRead)
  async onRead(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: unknown,
  ): Promise<WsAck<{ lastReadAt: string }>> {
    return this.handle(WsMarkReadSchema, body, async (p) => {
      const { userId } = socket.data;
      const { lastReadAt, memberIds } = await this.chats.markRead(p.chatId, userId, p.messageId);
      this.server.to(rooms(memberIds)).emit('message:read', { chatId: p.chatId, userId, lastReadAt });
      return { lastReadAt };
    });
  }

  /**
   * Yangi chat ochilganda a'zolar bir-birining onlayn holatini bilmaydi
   * (ulanish paytida umumiy chat yo'q edi) — har biriga qolganlarini yuboramiz.
   */
  async syncPresence(memberIds: string[]) {
    const lastSeen = await this.chats.lastSeenOf(memberIds);
    for (const to of memberIds) {
      for (const about of memberIds) {
        if (about === to) continue;
        const online = this.presence.isOnline(about);
        this.server.to(userRoom(to)).emit(WsEvent.PresenceUpdate, {
          userId:     about,
          online,
          lastSeenAt: online ? null : (lastSeen.get(about) ?? null),
        });
      }
    }
  }

  /**
   * Yangi guruh/a'zo qo'shilganda: yangi a'zolar va mavjud a'zolar bir-birining
   * onlayn holatini bilmaydi. Faqat onlayn bo'lganlar yuboriladi (oflayn
   * `lastSeenAt` chat javobida bor), shuning uchun N×N emas, N×onlayn.
   */
  syncPresenceBetween(fresh: string[], existing: string[]) {
    const emit = (to: string, about: string) => {
      if (to !== about && this.presence.isOnline(about)) {
        this.server.to(userRoom(to)).emit(WsEvent.PresenceUpdate, { userId: about, online: true, lastSeenAt: null });
      }
    };
    for (const a of fresh) {
      for (const b of existing) {
        emit(a, b);
        emit(b, a);
      }
    }
  }

  /** REST orqali yuborilgan xabar ham shu yerdan tarqatiladi. */
  emitMessageNew(message: Message, memberIds: string[], clientId?: string) {
    const others = memberIds.filter((id) => id !== message.senderId);
    if (others.length > 0) this.server.to(rooms(others)).emit(WsEvent.MessageNew, { message });
    this.server.to(userRoom(message.senderId)).emit(WsEvent.MessageNew, { message, clientId });
  }

  emitMessageUpdated(message: Message, memberIds: string[]) {
    this.server.to(rooms(memberIds)).emit(WsEvent.MessageUpdated, { message });
  }

  emitMessageDeleted(chatId: string, messageId: string, deletedAt: string, memberIds: string[]) {
    this.server.to(rooms(memberIds)).emit(WsEvent.MessageDeleted, { chatId, messageId, deletedAt });
  }

  emitChatUpdated(event: WsChatUpdated, recipientIds: string[]) {
    this.server.to(rooms(recipientIds)).emit(WsEvent.ChatUpdated, event);
  }

  emitChatDeleted(chatId: string, recipientIds: string[]) {
    this.server.to(rooms(recipientIds)).emit(WsEvent.ChatDeleted, { chatId });
  }

  emitMemberChange(change: MemberChange) {
    this.server.to(rooms(change.recipientIds)).emit(WsEvent.ChatMember, change.event);
  }

  /** Token tugaganda ulanishni uzadi; mijoz yangi token bilan qayta ulanadi (`@suhbat/client`). */
  private scheduleExpiry(socket: ChatSocket) {
    const { exp } = socket.data;
    if (exp === undefined) return;
    const wait = Math.max(0, exp * 1000 - Date.now());
    const timer = setTimeout(() => {
      if (wait > MAX_TIMER_MS) return this.scheduleExpiry(socket);
      socket.disconnect(true);
    }, Math.min(wait, MAX_TIMER_MS));
    timer.unref();
    this.clearExpiry(socket);
    this.expiryTimers.set(socket.id, timer);
  }

  private clearExpiry(socket: ChatSocket) {
    const t = this.expiryTimers.get(socket.id);
    if (t) clearTimeout(t);
    this.expiryTimers.delete(socket.id);
  }

  private async handle<P, R>(schema: ZodType<P>, body: unknown, fn: (p: P) => Promise<R>): Promise<WsAck<R>> {
    const parsed = schema.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'Validation failed' };
    try {
      return { ok: true, data: await fn(parsed.data) };
    } catch (e) {
      if (!(e instanceof HttpException)) this.logger.error('ws handler', e as Error);
      return { ok: false, error: errorText(e) };
    }
  }
}
