// src/hooks/useMessages.ts
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { UploadUrlInputSchema, kindOfFile, normalizeMime } from '@suhbat/core';
import type { UploadUrlInput } from '@suhbat/core';
import { v4 as uuidv4 } from 'uuid';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  appendOptimisticMessage,
  markMessageFailed,
  markMessageSending,
  messageDeleted,
  messageReceived,
  messageUpdated,
  prependOlder,
  removeOptimisticMessage,
  setLoadingOlder,
  setMessages,
  setMessagesError,
  setMessagesLoading,
} from '../features/messages/messagesSlice';
import { chatMessageReceived, lastMessageEdited } from '../features/chats/chatsSlice';
import { fetchChat, markChatRead } from '../features/realtime/realtimeThunks';
import { selectActiveChat } from '../features/chats/chatsSelectors';
import { api, socket } from '../services/api';
import { toMessage, withStatus } from '../services/apiMappers';
import { AttachmentKind, Message } from '../types';
import { errorText } from '../utils/errors';

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
  const rawRef = useRef(raw);
  rawRef.current = raw;

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
      (err: unknown) => {
        if (!cancelled) dispatch(setMessagesError({ chatId, error: errorText(err, 'Xabarlarni yuklab bo\'lmadi.') }));
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

  /** Matnni yuboradi (`clientId` = vaqtinchalik id — server ack'ida optimistik xabar almashtiriladi). */
  const deliver = useCallback(async (targetChatId: string, tempId: string, text: string) => {
    if (!user) return;
    try {
      // Asosiy yo'l — WebSocket; ulanish bo'lmasa REST zaxira.
      const saved = socket.isConnected()
        ? await socket.sendMessage({ chatId: targetChatId, content: text, clientId: tempId })
        : await api.sendMessage(targetChatId, { content: text, clientId: tempId });
      const message = toMessage(saved, chatRef.current);
      dispatch(messageReceived({ message, clientId: tempId }));
      dispatch(chatMessageReceived({ message, currentUid: user.uid, countUnread: false }));
    } catch {
      dispatch(markMessageFailed({ chatId: targetChatId, tempId }));
    }
  }, [user, dispatch]);

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
      editedAt:     null,
      isOptimistic: true,
    }));
    await deliver(chatId, tempId, text);
  }, [chatId, user, dispatch, deliver]);

  /** Yuborilmagan matnli xabarni qayta yuborish (o'sha `clientId` bilan — takrorlanmaydi). */
  const resendMessage = useCallback(async (tempId: string) => {
    if (!chatId) return;
    const msg = rawRef.current.find((m) => m.id === tempId);
    if (!msg || msg.status !== 'failed' || msg.type !== 'text') return;
    dispatch(markMessageSending({ chatId, tempId }));
    await deliver(chatId, tempId, msg.content);
  }, [chatId, dispatch, deliver]);

  /** Yuborilmagan xabarni ro'yxatdan olib tashlash (serverda yo'q). */
  const discardMessage = useCallback((tempId: string) => {
    if (!chatId) return;
    const msg = rawRef.current.find((m) => m.id === tempId);
    if (msg?.attachment?.url.startsWith('blob:')) URL.revokeObjectURL(msg.attachment.url);
    dispatch(removeOptimisticMessage({ chatId, tempId }));
  }, [chatId, dispatch]);

  /**
   * Fayl/rasm/ovoz: avval imzolangan URL orqali saqlashga yuklanadi, so'ng xabar
   * `attachmentId` bilan yuboriladi. Xato matnini qaytaradi (muvaffaqiyatda null).
   */
  const sendAttachment = useCallback(async (
    file: Blob & { name?: string },
    opts: { kind?: AttachmentKind; name?: string; durationMs?: number; caption?: string } = {},
  ): Promise<string | null> => {
    if (!chatId || !user) return null;
    const mime = normalizeMime(file.type);
    if (!mime) return 'Fayl turi aniqlanmadi';
    const kind = opts.kind ?? kindOfFile(mime);
    const name = opts.name ?? file.name ?? 'fayl';
    const checked = UploadUrlInputSchema.safeParse({
      chatId, kind, name, mime, size: file.size, durationMs: opts.durationMs,
    });
    if (!checked.success) return checked.error.issues[0]?.message ?? 'Faylni yuborib bo\'lmaydi';
    const input: UploadUrlInput = checked.data;

    const tempId = `optimistic-${uuidv4()}`;
    const previewUrl = URL.createObjectURL(file);
    const content = opts.caption?.trim() ?? '';
    dispatch(appendOptimisticMessage({
      id: tempId, chatId, senderId: user.uid, senderName: user.displayName, senderPhoto: user.photoURL,
      content, type: kind, status: 'sending',
      attachment: { id: tempId, kind, name, url: previewUrl, type: mime, size: file.size, durationMs: opts.durationMs ?? null },
      createdAt: Date.now(), updatedAt: Date.now(), editedAt: null, isOptimistic: true,
    }));
    try {
      const { attachmentId } = await api.uploadAttachment(input, file);
      const saved = socket.isConnected()
        ? await socket.sendMessage({ chatId, content, attachmentId, clientId: tempId })
        : await api.sendMessage(chatId, { content, attachmentId, clientId: tempId });
      const message = toMessage(saved, chatRef.current);
      dispatch(messageReceived({ message, clientId: tempId }));
      dispatch(chatMessageReceived({ message, currentUid: user.uid, countUnread: false }));
      URL.revokeObjectURL(previewUrl);
      return null;
    } catch (e) {
      dispatch(markMessageFailed({ chatId, tempId }));
      return errorText(e, 'Faylni yuborib bo\'lmadi. Qayta urinib ko\'ring.');
    }
  }, [chatId, user, dispatch]);

  const editMessage = useCallback(async (messageId: string, content: string) => {
    if (!chatId) return;
    const text = content.trim();
    const saved = socket.isConnected()
      ? await socket.editMessage(chatId, messageId, text)
      : await api.editMessage(chatId, messageId, text);
    const message = toMessage(saved, chatRef.current);
    dispatch(messageUpdated(message));
    dispatch(lastMessageEdited({ chatId, senderId: message.senderId, createdAt: message.createdAt, content: message.content }));
  }, [chatId, dispatch]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!chatId) return;
    if (socket.isConnected()) await socket.deleteMessage(chatId, messageId);
    else await api.deleteMessage(chatId, messageId);
    dispatch(messageDeleted({ chatId, messageId }));
    void dispatch(fetchChat(chatId));
  }, [chatId, dispatch]);

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
    sendAttachment,
    resendMessage,
    discardMessage,
    editMessage,
    deleteMessage,
    setTyping,
  };
};
