// src/hooks/useRealtime.ts — WebSocket voqealarini store'ga ulaydi.
import { useEffect } from 'react';
import { useAppDispatch } from '../app/hooks';
import { bumpSyncEpoch, setTyping } from '../features/chats/chatsSlice';
import {
  onChatDeleted,
  onChatMember,
  onChatUpdated,
  onMessageDeleted,
  onMessageNew,
  onMessageUpdated,
  onPresenceState,
  onPresenceUpdate,
  onRead,
} from '../features/realtime/realtimeThunks';
import { socket } from '../services/api';

/** "Yozmoqda" yangilanmasa shu vaqtdan keyin o'chadi (uzilish, yopilgan tab). */
export const TYPING_TTL_MS = 6000;

export const useRealtime = (enabled: boolean) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!enabled) return;
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    let wasConnected = socket.isConnected();

    const offs = [
      socket.on('message:new', (e) => dispatch(onMessageNew(e))),
      socket.on('message:updated', (e) => dispatch(onMessageUpdated(e))),
      socket.on('message:deleted', (e) => dispatch(onMessageDeleted(e))),
      socket.on('chat:updated', (e) => dispatch(onChatUpdated(e))),
      socket.on('chat:member', (e) => dispatch(onChatMember(e))),
      socket.on('chat:deleted', (e) => dispatch(onChatDeleted(e))),
      socket.on('message:read', (e) => dispatch(onRead(e))),
      socket.on('presence:state', (e) => dispatch(onPresenceState(e))),
      socket.on('presence:update', (e) => dispatch(onPresenceUpdate(e))),
      socket.on('typing', ({ chatId, userId, isTyping }) => {
        const key = `${chatId}:${userId}`;
        clearTimeout(typingTimers.get(key));
        dispatch(setTyping({ chatId, userId, isTyping }));
        if (isTyping) {
          typingTimers.set(key, setTimeout(() => dispatch(setTyping({ chatId, userId, isTyping: false })), TYPING_TTL_MS));
        }
      }),
      // Qayta ulanganda uzilish paytidagi xabarlarni qayta yuklaymiz.
      socket.onConnectionChange((connected) => {
        if (connected && wasConnected) dispatch(bumpSyncEpoch());
        if (connected) wasConnected = true;
      }),
    ];

    return () => {
      offs.forEach((off) => off());
      typingTimers.forEach((t) => clearTimeout(t));
    };
  }, [enabled, dispatch]);
};
