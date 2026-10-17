import type { SocketClient } from '@suhbat/client';

/**
 * Socket.IO ulanishini bir nechta "egasi" bo'lishi mumkin: ochiq UI va fon ulanishi
 * (foreground service). Ulanish kamida bitta egasi bor ekan saqlanadi; oxirgisi
 * qo'yib yuborganda uziladi. Shunda ilova oynasi yopilsa ham fon ulanishi uzilmaydi.
 */
export interface ConnectionKeeper {
  /** Ulanishni talab qiladi; qaytgan funksiya — talabni qaytarib oladi (bir marta). */
  hold(): () => void;
  readonly held: boolean;
}

export const createConnectionKeeper = (socket: Pick<SocketClient, 'connect' | 'disconnect'>): ConnectionKeeper => {
  const holders = new Set<symbol>();
  return {
    hold() {
      const key = Symbol('hold');
      holders.add(key);
      socket.connect();
      return () => {
        if (!holders.delete(key)) return;
        if (holders.size === 0) socket.disconnect();
      };
    },
    get held() {
      return holders.size > 0;
    },
  };
};
