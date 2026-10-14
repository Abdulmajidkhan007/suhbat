import { BadRequestException, ConflictException, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  CALL_RING_TIMEOUT_MS,
  WsCallIceSchema,
  WsCallInviteSchema,
  WsCallRefSchema,
  WsCallSdpSchema,
  WsEvent,
  callSummaryText,
} from '@suhbat/core';
import type { CallEndReason, WsAck, WsCallIncoming, WsCallRef } from '@suhbat/core';
import { userRoom } from '../chats/chat.gateway';
import type { ChatServer, ChatSocket } from '../chats/chat.gateway';
import { ChatGateway } from '../chats/chat.gateway';
import { ChatsService } from '../chats/chats.service';
import { ConnectionHoldService } from '../chats/connection-hold.service';
import { PresenceService } from '../chats/presence.service';
import { RateLimiter } from '../common/rate-limiter';
import { runWithAck } from '../common/ws-ack';
import { PushService } from '../push/push.service';
import { CallRegistry } from './call-registry';
import type { ActiveCall } from './call-registry';

export const CALL_NOT_FOUND = 'Qo\'ng\'iroq topilmadi';
export const CALLER_BUSY = 'Siz allaqachon qo\'ng\'iroqdasiz';
export const CALL_RATE_LIMITED = 'Juda tez-tez qo\'ng\'iroq qilyapsiz, biroz kuting';

const positive = (raw: string | undefined, fallback: number) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * 1:1 qo'ng'iroq signali (WebRTC media serverdan o'tmaydi). Holat — `CallRegistry`
 * (xotirada, bitta nusxa). Socket autentifikatsiyasi `ChatGateway` middleware'ida.
 *
 * Qoidalar: faqat 1:1 chat a'zolari, bloklanmagan; foydalanuvchi bir vaqtda bitta
 * qo'ng'iroqda (qabul qiluvchi band bo'lsa `call:busy`); javob bo'lmasa `CALL_RING_TIMEOUT_MS`
 * dan keyin `missed`; signal (offer/answer/ice) faqat qo'ng'iroqqa bog'langan ikki socket
 * orasida; bog'langan socket uzilsa qo'ng'iroq tugaydi. Natija chatga tizim xabari bo'lib yoziladi.
 */
@WebSocketGateway()
export class CallsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(CallsGateway.name);
  private readonly registry: CallRegistry;
  private readonly ringTimeoutMs: number;
  /** `call:invite` — foydalanuvchi bo'yicha (spam qo'ng'iroqqa qarshi). */
  private readonly inviteLimiter: RateLimiter;

  @WebSocketServer() server!: ChatServer;

  constructor(
    private readonly chats: ChatsService,
    private readonly chatGateway: ChatGateway,
    private readonly presence: PresenceService,
    private readonly holds: ConnectionHoldService,
    private readonly push: PushService,
    config: ConfigService,
  ) {
    this.ringTimeoutMs = positive(config.get<string>('CALL_RING_TIMEOUT_MS'), CALL_RING_TIMEOUT_MS);
    this.registry = new CallRegistry(this.ringTimeoutMs, (call) => this.finish(call.id, 'missed'));
    this.inviteLimiter = new RateLimiter(
      positive(config.get<string>('CALL_INVITE_LIMIT'), 10),
      positive(config.get<string>('CALL_INVITE_WINDOW_MS'), 60_000),
    );
  }

  onModuleDestroy() {
    this.registry.clear();
  }

  /** Push bosilib ilova ochilgan (yoki boshqa qurilma ulangan): hali jiringlayotgan qo'ng'iroqni ko'rsatamiz. */
  handleConnection(socket: ChatSocket) {
    const { userId } = socket.data;
    if (!userId) return;
    const call = this.registry.ofUser(userId);
    if (call && call.status === 'ringing' && call.calleeId === userId) {
      socket.emit(WsEvent.CallInvite, this.incoming(call));
    }
  }

  handleDisconnect(socket: ChatSocket) {
    for (const call of this.registry.bySocket(socket.id)) {
      // Chaqiruvchi javobni kutayotganda chiqib ketdi — bekor; gaplashayotganda — uzildi.
      this.finish(call.id, call.status === 'ringing' ? 'cancelled' : 'disconnected');
    }
  }

  @SubscribeMessage(WsEvent.CallInvite)
  async onInvite(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): Promise<WsAck<WsCallRef>> {
    const me = socket.data.userId;
    return runWithAck(this.logger, WsCallInviteSchema, body, async (p) => {
      if (!this.inviteLimiter.take(me)) throw new BadRequestException(CALL_RATE_LIMITED);
      if (this.registry.get(p.callId)) throw new ConflictException('Bu callId ishlatilgan');
      if (this.registry.isBusy(me)) throw new ConflictException(CALLER_BUSY);
      const calleeId = await this.chats.callPeer(p.chatId, me);
      const caller = await this.chats.publicUser(me);
      // `await` paytida holat o'zgargan bo'lishi mumkin — qayta tekshiramiz.
      if (this.registry.isBusy(me) || this.registry.get(p.callId)) throw new ConflictException(CALLER_BUSY);

      if (this.registry.isBusy(calleeId)) {
        socket.emit(WsEvent.CallBusy, { callId: p.callId });
        void this.writeSummary(p.chatId, me, callSummaryText(p.media, 'busy', null));
        return { callId: p.callId };
      }

      const call = this.registry.start({
        id:           p.callId,
        chatId:       p.chatId,
        media:        p.media,
        callerId:     me,
        calleeId,
        callerSocket: socket.id,
        caller,
      });
      this.holds.hold(socket.id);
      this.server.to(userRoom(calleeId)).emit(WsEvent.CallInvite, this.incoming(call));
      if (!this.presence.isOnline(calleeId)) {
        void this.push.notifyIncomingCall({
          callId:     call.id,
          chatId:     call.chatId,
          media:      call.media,
          callerName: caller.displayName,
          calleeId,
          ttlSeconds: Math.ceil(this.ringTimeoutMs / 1000),
        });
      }
      return { callId: call.id };
    });
  }

  /** Qabul qiluvchining qurilmasi kiruvchi qo'ng'iroqni ko'rsatdi — chaqiruvchiga "jiringlamoqda". */
  @SubscribeMessage(WsEvent.CallRinging)
  onRinging(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): void {
    const parsed = WsCallRefSchema.safeParse(body);
    if (!parsed.success) return;
    const call = this.registry.get(parsed.data.callId);
    if (!call || call.status !== 'ringing' || call.calleeId !== socket.data.userId) return;
    this.server.to(call.callerSocket).emit(WsEvent.CallRinging, { callId: call.id });
  }

  @SubscribeMessage(WsEvent.CallAccept)
  async onAccept(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): Promise<WsAck<WsCallRef>> {
    return runWithAck(this.logger, WsCallRefSchema, body, async ({ callId }) => {
      const call = this.registry.get(callId);
      if (!call || call.calleeId !== socket.data.userId) throw new NotFoundException(CALL_NOT_FOUND);
      if (call.status !== 'ringing') throw new ConflictException('Qo\'ng\'iroq allaqachon qabul qilingan');
      this.registry.accept(callId, socket.id);
      this.holds.hold(socket.id);
      this.server.to(call.callerSocket).emit(WsEvent.CallAccept, { callId });
      // Qabul qiluvchining boshqa qurilmalari jiringlashni to'xtatadi.
      this.server
        .to(userRoom(call.calleeId))
        .except(socket.id)
        .emit(WsEvent.CallEnd, { callId, reason: 'answered_elsewhere', durationMs: null });
      return { callId };
    });
  }

  @SubscribeMessage(WsEvent.CallReject)
  async onReject(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): Promise<WsAck<WsCallRef>> {
    return runWithAck(this.logger, WsCallRefSchema, body, async ({ callId }) => {
      const call = this.registry.get(callId);
      if (!call || call.calleeId !== socket.data.userId || call.status !== 'ringing') {
        throw new NotFoundException(CALL_NOT_FOUND);
      }
      this.finish(callId, 'rejected');
      return { callId };
    });
  }

  @SubscribeMessage(WsEvent.CallCancel)
  async onCancel(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): Promise<WsAck<WsCallRef>> {
    return runWithAck(this.logger, WsCallRefSchema, body, async ({ callId }) => {
      const call = this.registry.get(callId);
      if (!call || call.callerSocket !== socket.id || call.status !== 'ringing') {
        throw new NotFoundException(CALL_NOT_FOUND);
      }
      this.finish(callId, 'cancelled');
      return { callId };
    });
  }

  /**
   * Gaplashayotganda tugatish. Qulaylik uchun jiringlash paytida ham ishlaydi:
   * chaqiruvchi uchun — bekor, qabul qiluvchi uchun — rad.
   */
  @SubscribeMessage(WsEvent.CallEnd)
  async onEnd(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): Promise<WsAck<WsCallRef>> {
    return runWithAck(this.logger, WsCallRefSchema, body, async ({ callId }) => {
      const call = this.registry.get(callId);
      const me = socket.data.userId;
      if (!call || (me !== call.callerId && me !== call.calleeId)) throw new NotFoundException(CALL_NOT_FOUND);
      if (call.status === 'accepted') {
        if (this.registry.socketOf(call, me) !== socket.id) throw new NotFoundException(CALL_NOT_FOUND);
        this.finish(callId, 'hangup');
      } else if (me === call.callerId) {
        if (call.callerSocket !== socket.id) throw new NotFoundException(CALL_NOT_FOUND);
        this.finish(callId, 'cancelled');
      } else {
        this.finish(callId, 'rejected');
      }
      return { callId };
    });
  }

  @SubscribeMessage(WsEvent.CallOffer)
  onOffer(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): void {
    const parsed = WsCallSdpSchema.safeParse(body);
    if (!parsed.success || parsed.data.description.type !== 'offer') return;
    this.relay(socket, parsed.data.callId, 'caller', (to) => this.server.to(to).emit(WsEvent.CallOffer, parsed.data));
  }

  @SubscribeMessage(WsEvent.CallAnswer)
  onAnswer(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): void {
    const parsed = WsCallSdpSchema.safeParse(body);
    if (!parsed.success || parsed.data.description.type !== 'answer') return;
    this.relay(socket, parsed.data.callId, 'callee', (to) => this.server.to(to).emit(WsEvent.CallAnswer, parsed.data));
  }

  @SubscribeMessage(WsEvent.CallIce)
  onIce(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): void {
    const parsed = WsCallIceSchema.safeParse(body);
    if (!parsed.success) return;
    this.relay(socket, parsed.data.callId, 'any', (to) => this.server.to(to).emit(WsEvent.CallIce, parsed.data));
  }

  /** Faol qo'ng'iroqlar soni (testlar va kuzatuv uchun). */
  get activeCalls(): number {
    return this.registry.size;
  }

  /**
   * Signalni ikkinchi tomonning bog'langan socket'iga uzatadi — faqat qabul qilingan
   * qo'ng'iroqda va faqat shu qo'ng'iroqqa bog'langan socket'dan.
   */
  private relay(socket: ChatSocket, callId: string, from: 'caller' | 'callee' | 'any', send: (to: string) => void) {
    const call = this.registry.get(callId);
    if (!call || call.status !== 'accepted' || !call.calleeSocket) return;
    const fromCaller = socket.id === call.callerSocket && socket.data.userId === call.callerId;
    const fromCallee = socket.id === call.calleeSocket && socket.data.userId === call.calleeId;
    if (from === 'caller' ? !fromCaller : from === 'callee' ? !fromCallee : !(fromCaller || fromCallee)) return;
    send(fromCaller ? call.calleeSocket : call.callerSocket);
  }

  private incoming(call: ActiveCall): WsCallIncoming {
    return {
      callId:    call.id,
      chatId:    call.chatId,
      media:     call.media,
      from:      call.caller,
      createdAt: new Date(call.createdAt).toISOString(),
    };
  }

  /** Registrdan olib tashlaydi, ikkala foydalanuvchining hamma qurilmasiga `call:end`, chatga tizim xabari. */
  private finish(callId: string, reason: CallEndReason) {
    const found = this.registry.get(callId);
    if (!found) return;
    const durationMs = this.registry.durationMs(found);
    const call = this.registry.finish(callId) ?? found;
    this.holds.release(call.callerSocket);
    if (call.calleeSocket) this.holds.release(call.calleeSocket);
    this.server
      .to([userRoom(call.callerId), userRoom(call.calleeId)])
      .emit(WsEvent.CallEnd, { callId, reason, durationMs });
    void this.writeSummary(call.chatId, call.callerId, callSummaryText(call.media, reason, durationMs));
  }

  private async writeSummary(chatId: string, callerId: string, text: string) {
    try {
      const { message, memberIds } = await this.chats.createSystemMessage(chatId, callerId, text);
      this.chatGateway.emitMessageNew(message, memberIds);
    } catch (e) {
      this.logger.error('qo\'ng\'iroq xabari', e as Error);
    }
  }
}
