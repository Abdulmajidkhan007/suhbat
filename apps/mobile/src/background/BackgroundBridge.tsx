import { useEffect } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { useNavigation } from '../navigation/Navigator';
import { useSession } from '../state/SessionProvider';

/**
 * UI ↔ fon bildirishnomalari: ochilgan chatning bildirishnomasini tozalaydi,
 * bildirishnoma bosilganda chatni ochadi, Android 13+ da
 * bildirishnoma ruxsatini so'raydi. iOS / native yo'q — hech narsa qilmaydi.
 */
export const BackgroundBridge = () => {
  const { services: { background } } = useSession();
  const { native } = background;
  const { route, push: navigate } = useNavigation();
  const chatId = route.name === 'chat' ? route.chatId : null;

  useEffect(() => {
    if (!chatId || !native.available) return;
    const clear = () => { if (AppState.currentState === 'active') native.cancelNotification(chatId); };
    clear();
    const sub = AppState.addEventListener('change', clear);
    return () => sub.remove();
  }, [chatId, native]);

  // Bildirishnoma bosildi: yopiq holatdan (ishga tushishda) yoki ilova ochiq/fonda.
  useEffect(() => {
    if (!native.available) return;
    const open = () => {
      native.consumeOpenChat().then(
        (id) => { if (id) navigate({ name: 'chat', chatId: id }); },
        () => undefined,
      );
    };
    open();
    return native.onOpenChatRequest(open);
  }, [native, navigate]);

  // Mahalliy bildirishnoma uchun ruxsat (FCM bo'lmasa ham kerak).
  useEffect(() => {
    if (!background.available || Platform.OS !== 'android' || Number(Platform.Version) < 33) return;
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => undefined);
  }, [background]);

  return null;
};

