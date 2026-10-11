// src/hooks/useMessages.ts
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  appendOptimisticMessage,
  markMessageFailed,
  messageReceived,
  prependOlder,
  setLoadingOlder,
  setMessages,
  setMessagesError,
  setMessagesLoading,
} from '../features/messages/messagesSlice';
import { chatMessageReceived } from '../features/chats/chatsSlice';
import { markChatRead } from '../features/realtime/realtimeThunks';
import { selectActiveChat } from '../features/chats/chatsSelectors';
import { api, socket } from '../services/api';
import { toMessage, withStatus } from '../services/apiMappers';
import { Message } from '../types';

const PAGE_SIZE = 50;
/** "Yozmoqda" qayta yuborish oralig'i va jim turgandan keyin to'xtash vaqti. */
const TYPING_RESEND_MS = 3000;
const TYPING_IDLE_MS = 4000;
const EMPTY: Message[] = [];

export const useMessages = (chatId: string | null) => {
  const dispatch   = useAppDispatch();
  const user       = useAppSelector((s) => s.auth.user);
  const chat       = useAppSelector(selectActiveChat);
  const syncEpoch  = useAppSelector((s) => s.chats.syncEpoch);
  const raw        = useAppSelector((s) => (chatId ? (s.messages.messagesByChatId[chatId] ?? EMPTY) : EMPTY));
  const loading    = useAppSelector((s) => (chatId ? (s.messages.loadingByChatId[chatId] ?? true) : false));
  const error      = useAppSelector((s) => (chatId ? (s.messages.errorByChatId[chatId] ?? null) : null));
  const nextCursor = useAppSelector((s) => (chatId ? (s.messages.nextCursorByChatId[chatId] ?? null) : null));
  const loadingOlder = useAppSelector((s) => (chatId ? (s.messages.loadingOlderByChatId[chatId] ?? false) : false));

  const chatRef = useRef(chat);
  chatRef.current = chat;

  // Tarixning birinchi sahifasi (chat almashganda va qayta ulanganda).
  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;
    dispatch(setMessagesLoading({ chatId, loading: true }));
    api.listMessages(chatId, { limit: PAGE_SIZE }).then(
      (page) => {
        if (cancelled) return;
        dispatch(setMessages({
          chatId,
          messages:   page.items.map((m) => toMessage(m, chatRef.current)),
          nextCursor: page.nextCursor,
        }));
        void dispatch(markChatRead(chatId));
      },
      (err: Error) => {
        if (!cancelled) dispatch(setMessagesError({ chatId, error: err.message || 'Xabarlarni yuklab bo\'lmadi' }));
      },
    );
    return () => { cancelled = true; };
  }, [chatId, syncEpoch, dispatch]);

  // Tab yana ko'rinadigan bo'lsa — o'qildi deb belgilaymiz.
  useEffect(() => {
    if (!chatId) return;
    const onVisible = () => { if (document.visibilityState === 'visible') void dispatch(markChatRead(chatId)); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [chatId, dispatch]);

  const loadOlder = useCallback(async () => {
    if (!chatId || !nextCursor || loadingOlder) return;
    dispatch(setLoadingOlder({ chatId, loading: true }));
    try {
      const page = await api.listMessages(chatId, { before: nextCursor, limit: PAGE_SIZE });
      dispatch(prependOlder({
        chatId,
        messages:   page.items.map((m) => toMessage(m, chatRef.current)),
        nextCursor: page.nextCursor,
      }));
    } catch {
      dispatch(setLoadingOlder({ chatId, loading: false }));
    }
  }, [chatId, nextCursor, loadingOlder, dispatch]);

  const sendMessage = useCallback(async (content: string) => {
    const text = content.trim();
    if (!chatId || !user || !text) return;
    const tempId = `optimistic-${uuidv4()}`;
    dispatch(appendOptimisticMessage({
      id:           tempId,
      chatId,
      senderId:     user.uid,
      senderName:   user.displayName,
      senderPhoto:  user.photoURL,
      content:      text,
      type:         'text',
      status:       'sending',
      createdAt:    Date.now(),
      updatedAt:    Date.now(),
      isOptimistic: true,
    }));
    try {
      // Asosiy yo'l — WebSocket; ulanish bo'lmasa REST zaxira.
      const saved = socket.isConnected()
        ? await socket.sendMessage({ chatId, content: text, clientId: tempId })
        : await api.sendMessage(chatId, { content: text, clientId: tempId });
      const message = toMessage(saved, chatRef.current);
      dispatch(messageReceived({ message, clientId: tempId }));
      dispatch(chatMessageReceived({ message, currentUid: user.uid, countUnread: false }));
    } catch {
      dispatch(markMessageFailed({ chatId, tempId }));
    }
  }, [chatId, user, dispatch]);

  // "Yozmoqda": har TYPING_RESEND_MS da bir marta true, jim qolsa false.
  const typingRef = useRef<{ sentAt: number; idle?: ReturnType<typeof setTimeout> }>({ sentAt: 0 });
  const stopTyping = useCallback(() => {
    const t = typingRef.current;
    clearTimeout(t.idle);
    if (t.sentAt && chatId) socket.setTyping(chatId, false);
    t.sentAt = 0;
  }, [chatId]);
  const setTyping = useCallback((isTyping: boolean) => {
    if (!chatId) return;
    if (!isTyping) return stopTyping();
    const t = typingRef.current;
    if (Date.now() - t.sentAt > TYPING_RESEND_MS) {
      socket.setTyping(chatId, true);
      t.sentAt = Date.now();
    }
    clearTimeout(t.idle);
    t.idle = setTimeout(stopTyping, TYPING_IDLE_MS);
  }, [chatId, stopTyping]);
  useEffect(() => stopTyping, [stopTyping]);

  // Ism/rasm chat a'zolaridan (xabar chat ma'lumotidan oldin kelgan bo'lishi mumkin).
  const messages = useMemo(() => {
    if (!user) return raw;
    return raw.map((m) => {
      const p = m.senderName ? null : chat?.participantDetails[m.senderId];
      const filled = p ? { ...m, senderName: p.displayName, senderPhoto: p.photoURL } : m;
      return withStatus(filled, chat, user.uid);
    });
  }, [raw, chat, user]);

  return {
    messages,
    loading,
    error,
    hasOlder: nextCursor !== null,
    loadingOlder,
    loadOlder,
    sendMessage,
    setTyping,
  };
};
