import type { CallMedia, PublicUser } from '@suhbat/core';

export type CallStatus = 'ringing' | 'accepted';

/** Server xotirasidagi bitta qo'ng'iroq. */
export interface ActiveCall {
  id:           string;
  chatId:       string;
  media:        CallMedia;
  callerId:     string;
  calleeId:     string;
  /** Chaqiruvchi — signal (offer/ice) faqat shu socket bilan; qabul qilingan qo'ng'iroqda uzilsa `null` (tiklashni kutadi). */
  callerSocket: string | null;
  /** Qabul qilgan qurilma socket'i; jiringlayotganda `null` (hamma qurilma jiringlaydi), qabul qilingach uzilsa ham `null`. */
  calleeSocket: string | null;
  status:       CallStatus;
  /** Qayta ulangan qurilmaga `call:invite` ni qayta yuborish uchun. */
  caller:       PublicUser;
  createdAt:    number;
  acceptedAt:   number | null;
}

export type NewCall = Omit<ActiveCall, 'calleeSocket' | 'callerSocket' | 'status' | 'createdAt' | 'acceptedAt'> & {
  callerSocket: string;
};

export interface ResumeOptions {
  /** Qabul qilingan qo'ng'iroqda socket uzilgach tiklashni kutish muddati. */
  graceMs:   number;
  /** Muddat tugadi (qo'ng'iroq registrda qoladi — chaqiruvchi `finish` qiladi). */
  onExpired: (call: ActiveCall) => void;
}

/**
 * Faol qo'ng'iroqlar — **bitta API nusxasi xotirasida** (ko'p nusxa uchun Redis kerak, REJA.md).
 * Foydalanuvchi bir vaqtda faqat bitta qo'ng'iroqda. Jiringlash `ringTimeoutMs` dan
 * oshsa `onTimeout` chaqiriladi (qo'ng'iroq registrda qoladi — chaqiruvchi `finish` qiladi).
 * Qabul qilingan qo'ng'iroqda socket uzilsa `detach` uni `resume.graceMs` kutadi:
 * muddat ichida ishtirokchining yangi socket'i `resume` qilsa qo'ng'iroq davom etadi,
 * aks holda `resume.onExpired`.
 */
export class CallRegistry {
  private readonly calls = new Map<string, ActiveCall>();
  private readonly byUser = new Map<string, string>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly graceTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly ringTimeoutMs: number,
    private readonly onTimeout: (call: ActiveCall) => void,
    private readonly resumeOpts: ResumeOptions,
    private readonly now: () => number = Date.now,
  ) {}

  get(callId: string): ActiveCall | undefined {
    return this.calls.get(callId);
  }

  /** Foydalanuvchi qatnashayotgan (jiringlayotgan yoki faol) qo'ng'iroq. */
  ofUser(userId: string): ActiveCall | undefined {
    const id = this.byUser.get(userId);
    return id ? this.calls.get(id) : undefined;
  }

  isBusy(userId: string): boolean {
    return this.byUser.has(userId);
  }

  /** Chaqiruvchi ham, qabul qiluvchi ham bo'sh bo'lishi kerak (gateway oldin tekshiradi). */
  start(input: NewCall): ActiveCall {
    if (this.calls.has(input.id)) throw new Error('callId band');
    if (this.isBusy(input.callerId) || this.isBusy(input.calleeId)) throw new Error('foydalanuvchi band');
    const call: ActiveCall = { ...input, calleeSocket: null, status: 'ringing', createdAt: this.now(), acceptedAt: null };
    this.calls.set(call.id, call);
    this.byUser.set(call.callerId, call.id);
    this.byUser.set(call.calleeId, call.id);
    const timer = setTimeout(() => {
      this.timers.delete(call.id);
      if (this.calls.get(call.id)?.status === 'ringing') this.onTimeout(call);
    }, this.ringTimeoutMs);
    timer.unref();
    this.timers.set(call.id, timer);
    return call;
  }

  accept(callId: string, calleeSocket: string): ActiveCall {
    const call = this.calls.get(callId);
    if (!call || call.status !== 'ringing') throw new Error('qo\'ng\'iroq jiringlamayapti');
    call.status = 'accepted';
    call.calleeSocket = calleeSocket;
    call.acceptedAt = this.now();
    this.clearTimer(callId);
    return call;
  }

  /** Registrdan olib tashlaydi; qaytaradi — tugagan qo'ng'iroq (yoki allaqachon yo'q bo'lsa `undefined`). */
  finish(callId: string): ActiveCall | undefined {
    const call = this.calls.get(callId);
    if (!call) return undefined;
    this.calls.delete(callId);
    this.clearTimer(callId);
    this.clearGrace(callId);
    if (this.byUser.get(call.callerId) === callId) this.byUser.delete(call.callerId);
    if (this.byUser.get(call.calleeId) === callId) this.byUser.delete(call.calleeId);
    return call;
  }

  /** Shu socket bog'langan qo'ng'iroqlar (chaqiruvchi yoki qabul qilgan qurilma). */
  bySocket(socketId: string): ActiveCall[] {
    return [...this.calls.values()].filter((c) => c.callerSocket === socketId || c.calleeSocket === socketId);
  }

  /**
   * Socket uzildi: shu socket bog'langan **qabul qilingan** qo'ng'iroqlarda tomon "uzilgan"
   * bo'ladi (`null`) va tiklash muddati boshlanadi. Jiringlayotgan qo'ng'iroqlarga tegmaydi
   * (ularni gateway bekor qiladi). Qaytaradi — uzilgan qo'ng'iroqlar.
   */
  detach(socketId: string): ActiveCall[] {
    const detached: ActiveCall[] = [];
    for (const call of this.bySocket(socketId)) {
      if (call.status !== 'accepted') continue;
      if (call.callerSocket === socketId) call.callerSocket = null;
      if (call.calleeSocket === socketId) call.calleeSocket = null;
      this.startGrace(call);
      detached.push(call);
    }
    return detached;
  }

  /**
   * Ishtirokchi yangi socket bilan qo'ng'iroqqa qaytdi. Faqat qabul qilingan qo'ng'iroqning
   * chaqiruvchisi yoki qabul qiluvchisi; aks holda xato. Qaytaradi — qo'ng'iroq va suhbatdoshning
   * hozirgi socket'i (uzilgan bo'lsa `null`). Ikkala tomon ham ulangach muddat to'xtatiladi.
   */
  resume(callId: string, userId: string, socketId: string): { call: ActiveCall; peerSocket: string | null } {
    const call = this.calls.get(callId);
    if (!call || call.status !== 'accepted') throw new Error('qo\'ng\'iroq faol emas');
    if (userId === call.callerId) call.callerSocket = socketId;
    else if (userId === call.calleeId) call.calleeSocket = socketId;
    else throw new Error('qo\'ng\'iroq ishtirokchisi emas');
    const peerSocket = userId === call.callerId ? call.calleeSocket : call.callerSocket;
    if (call.callerSocket && call.calleeSocket) this.clearGrace(callId);
    return { call, peerSocket };
  }

  /** Ishtirokchining signal socket'i; qatnashmasa yoki hali qabul qilinmagan bo'lsa `null`. */
  socketOf(call: ActiveCall, userId: string): string | null {
    if (userId === call.callerId) return call.callerSocket;
    if (userId === call.calleeId) return call.calleeSocket;
    return null;
  }

  durationMs(call: ActiveCall): number | null {
    return call.acceptedAt === null ? null : Math.max(0, this.now() - call.acceptedAt);
  }

  get size(): number {
    return this.calls.size;
  }

  clear(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.graceTimers.forEach((t) => clearTimeout(t));
    this.graceTimers.clear();
    this.calls.clear();
    this.byUser.clear();
  }

  private startGrace(call: ActiveCall) {
    if (this.graceTimers.has(call.id)) return;
    const timer = setTimeout(() => {
      this.graceTimers.delete(call.id);
      const live = this.calls.get(call.id);
      if (live && (!live.callerSocket || !live.calleeSocket)) this.resumeOpts.onExpired(live);
    }, this.resumeOpts.graceMs);
    timer.unref();
    this.graceTimers.set(call.id, timer);
  }

  private clearGrace(callId: string) {
    clearTimeout(this.graceTimers.get(callId));
    this.graceTimers.delete(callId);
  }

  private clearTimer(callId: string) {
    clearTimeout(this.timers.get(callId));
    this.timers.delete(callId);
  }
}
