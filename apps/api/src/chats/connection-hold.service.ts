import { Injectable } from '@nestjs/common';

/**
 * Hozir uzib bo'lmaydigan socket'lar (masalan, faol qo'ng'iroq signali shu socket orqali).
 * Access token muddati tugaganda gateway bunday socket'ni darhol uzmaydi — qo'ng'iroq
 * tugashini kutadi (aks holda har 15 daqiqada qo'ng'iroq uzilardi).
 */
@Injectable()
export class ConnectionHoldService {
  private readonly held = new Set<string>();

  hold(socketId: string): void {
    this.held.add(socketId);
  }

  release(socketId: string): void {
    this.held.delete(socketId);
  }

  isHeld(socketId: string): boolean {
    return this.held.has(socketId);
  }
}
