import { useCallback, useEffect, useRef, useState } from 'react';
import { InAppBanner } from '../components/InAppBanner';
import { useNavigation } from '../navigation/Navigator';
import type { ForegroundPush } from '../services/push';
import { useSession } from '../state/SessionProvider';

/** In-app banner shuncha vaqtdan keyin o'zi yopiladi. */
export const BANNER_TTL_MS = 4_000;

/**
 * Kirgan foydalanuvchi uchun push: ruxsat so'rash, tokenni serverga yozish
 * (va `onTokenRefresh` da yangilash), ilova ochiqligida banner, bildirishnoma
 * bosilganda shu chatni ochish. Firebase sozlanmagan bo'lsa — hech narsa qilmaydi.
 */
export const PushNotifications = () => {
  const { services: { api, push } } = useSession();
  const { route, push: navigate } = useNavigation();
  const [banner, setBanner] = useState<ForegroundPush | null>(null);
  const routeRef = useRef(route);
  routeRef.current = route;

  const isOpen = useCallback(
    (chatId: string) => routeRef.current.name === 'chat' && routeRef.current.chatId === chatId,
    [],
  );

  const openChat = useCallback((chatId: string) => {
    setBanner(null);
    if (!isOpen(chatId)) navigate({ name: 'chat', chatId });
  }, [isOpen, navigate]);

  // Ruxsat → token → server; token yangilansa qayta yoziladi.
  useEffect(() => {
    if (!push.available) return;
    let cancelled = false;
    const register = (token: string) =>
      api.registerDevice({ platform: push.platform, token }).catch(() => undefined);
    (async () => {
      try {
        if (!(await push.requestPermission()) || cancelled) return;
        const token = await push.getToken();
        if (token && !cancelled) await register(token);
      } catch {
        // Push ixtiyoriy: xato ilova ishiga ta'sir qilmaydi.
      }
    })();
    const off = push.onTokenRefresh((token) => void register(token));
    return () => {
      cancelled = true;
      off();
    };
  }, [api, push]);

  // Bildirishnoma bosilgan: yopiq holatdan ochilgan yoki fondan qaytgan.
  useEffect(() => {
    let cancelled = false;
    push.getInitialNotification().then(
      (data) => { if (data && !cancelled) openChat(data.chatId); },
      () => undefined,
    );
    const off = push.onNotificationOpened((data) => openChat(data.chatId));
    return () => {
      cancelled = true;
      off();
    };
  }, [push, openChat]);

  // Ilova ochiq: shu chat ochiq bo'lmasa banner. Qo'ng'iroq — banner emas: socket orqali
  // kiruvchi qo'ng'iroq ekrani chiqadi (server ulanganda `call:invite` ni qayta yuboradi).
  useEffect(() => push.onForegroundMessage((p) => {
    if (p.data.type === 'call') return;
    if (!isOpen(p.data.chatId)) setBanner(p);
  }), [push, isOpen]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), BANNER_TTL_MS);
    return () => clearTimeout(timer);
  }, [banner]);

  // Banner ko'rinib turgan chat ochilsa — yopiladi.
  useEffect(() => {
    if (banner && route.name === 'chat' && route.chatId === banner.data.chatId) setBanner(null);
  }, [banner, route]);

  if (!banner) return null;
  return (
    <InAppBanner
      title={banner.title}
      body={banner.body}
      onPress={() => openChat(banner.data.chatId)}
      onDismiss={() => setBanner(null)}
    />
  );
};
