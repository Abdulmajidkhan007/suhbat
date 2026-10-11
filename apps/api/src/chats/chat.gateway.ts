import { HttpException, Logger } from '@nestjs/common';
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
  WsEvent,
  WsMarkReadSchema,
  WsSendMessageSchema,
  WsTypingSchema,
} from '@suhbat/core';
import type { ClientToServerEvents, Message, ServerToClientEvents, WsAck } from '@suhbat/core';
import type { Server, Socket } from 'socket.io';
import type { ZodType } from 'zod';
import type { JwtPayload } from '../auth/auth.service';
import { ChatsService } from './chats.service';
import { PresenceService } from './presence.service';

interface SocketData {
  userId: string;
}
type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const userRoom = (userId: string) => `user:${userId}`;

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
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

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
          next();
        })
        .catch(() => next(new Error(WS_UNAUTHORIZED)));
    });
  }

  async handleConnection(socket: ChatSocket) {
    const { userId } = socket.data;
    if (!userId) return socket.disconnect(true);
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

  async handleDisconnect(socket: ChatSocket) {
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
      const { message, memberIds } = await this.chats.sendMessage(p.chatId, socket.data.userId, p.content);
      this.emitMessageNew(message, memberIds, p.clientId);
      return message;
    });
  }

  @SubscribeMessage(WsEvent.Typing)
  async onTyping(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): Promise<void> {
    const parsed = WsTypingSchema.safeParse(body);
    if (!parsed.success) return;
    const { userId } = socket.data;
    try {
      const memberIds = await this.chats.memberIds(parsed.data.chatId, userId);
      const others = memberIds.filter((id) => id !== userId);
      if (others.length > 0) {
        this.server.to(others.map(userRoom)).emit('typing', { ...parsed.data, userId });
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
      this.server.to(memberIds.map(userRoom)).emit('message:read', { chatId: p.chatId, userId, lastReadAt });
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

  /** REST orqali yuborilgan xabar ham shu yerdan tarqatiladi. */
  emitMessageNew(message: Message, memberIds: string[], clientId?: string) {
    const others = memberIds.filter((id) => id !== message.senderId);
    if (others.length > 0) this.server.to(others.map(userRoom)).emit(WsEvent.MessageNew, { message });
    this.server.to(userRoom(message.senderId)).emit(WsEvent.MessageNew, { message, clientId });
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
