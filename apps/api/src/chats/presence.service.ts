import { Injectable } from '@nestjs/common';

/**
 * Kim onlayn — shu API nusxasi xotirasida (userId → socket id'lar).
 * Bir nechta nusxada ishlash uchun keyin Redis'ga ko'chadi (REJA.md).
 */
@Injectable()
export class PresenceService {
  private readonly sockets = new Map<string, Set<string>>();

  /** `true` — foydalanuvchining birinchi ulanishi (offline → online). */
  connect(userId: string, socketId: string): boolean {
    const set = this.sockets.get(userId) ?? new Set<string>();
    const first = set.size === 0;
    set.add(socketId);
    this.sockets.set(userId, set);
    return first;
  }

  /** `true` — oxirgi ulanish uzildi (online → offline). */
  disconnect(userId: string, socketId: string): boolean {
    const set = this.sockets.get(userId);
    if (!set || !set.delete(socketId)) return false;
    if (set.size > 0) return false;
    this.sockets.delete(userId);
    return true;
  }

  isOnline(userId: string): boolean {
    return this.sockets.has(userId);
  }
}
