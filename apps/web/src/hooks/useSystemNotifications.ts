// src/hooks/useSystemNotifications.ts — tizim bildirishnomalari (brauzer Notification API; Electron'da ham).
import { useEffect, useRef } from 'react';
import { createMessageNotifier } from '@suhbat/client';
import type { ShownNotification } from '@suhbat/client';
import { api, socket } from '../services/api';

/** Sahifa ko'rinib va fokusda turibdi — foydalanuvchi ilovada, bildirishnoma kerak emas. */
const pageInFocus = () => document.visibilityState === 'visible' && document.hasFocus();

/**
 * Ilova ochiq, lekin fonda (boshqa tab/oyna) bo'lganda yangi xabar va kiruvchi qo'ng'iroq
 * uchun tizim bildirishnomasi. Bosilganda oyna fokuslanadi va chat ochiladi. Ruxsat
 * birinchi bosishda so'raladi (Safari/Firefox foydalanuvchi harakatisiz so'rashga yo'l qo'ymaydi).
 * Ilova (tab) yopiq bo'lsa — yo'q: buning uchun Web Push kerak (hali yo'q).
 */
export const useSystemNotifications = (openChat: (chatId: string) => void) => {
  const openRef = useRef(openChat);
  openRef.current = openChat;

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const askPermission = () => {
      if (Notification.permission === 'default') void Notification.requestPermission().catch(() => undefined);
    };
    window.addEventListener('pointerdown', askPermission, { once: true });

    const shown = new Map<string, Notification>();
    const show = (n: ShownNotification) => {
      if (Notification.permission !== 'granted') return;
      shown.get(n.tag)?.close();
      const notification = new Notification(n.title, {
        body:               n.body,
        tag:                n.tag,
        icon:               '/logo192.png',
        requireInteraction: n.kind === 'call',
      });
      notification.onclick = () => {
        window.focus();
        openRef.current(n.chatId);
        notification.close();
      };
      notification.onclose = () => {
        if (shown.get(n.tag) === notification) shown.delete(n.tag);
      };
      shown.set(n.tag, notification);
    };

    const stop = createMessageNotifier({
      api,
      socket,
      isSeen:  () => pageInFocus(),
      show,
      cancel:  (tag) => shown.get(tag)?.close(),
      onError: (e) => console.warn('bildirishnoma', e),
    });
    // Ilovaga qaytganda ko'rsatilganlar yopiladi (xabarlar endi ko'rinib turibdi).
    const clear = () => {
      if (!pageInFocus()) return;
      shown.forEach((n) => n.close());
      shown.clear();
    };
    window.addEventListener('focus', clear);

    return () => {
      stop();
      window.removeEventListener('pointerdown', askPermission);
      window.removeEventListener('focus', clear);
    };
  }, []);
};
