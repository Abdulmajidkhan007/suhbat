import type { ChatSummary } from '@suhbat/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ReactNode } from 'react';
import { chatReducer, initialChatState } from './chatState';
import type { ChatState, LocalMessage } from './chatState';
import { useCurrentUser, useSession } from './SessionProvider';

/** Qabul qiluvchida "yozmoqda" shuncha vaqtdan keyin o'chadi (yuboruvchi har 3 s yangilaydi). */
export const TYPING_TTL_MS = 6_000;

interface ChatStore {
  state:         ChatState;
  refreshChats:  () => Promise<void>;
  loadMessages:  (chatId: string, older?: boolean) => Promise<void>;
  sendText:      (chatId: string, text: string) => Promise<void>;
  resend:        (message: LocalMessage) => Promise<void>;
  setTyping:     (chatId: string, isTyping: boolean) => void;
  markRead:      (chatId: string, messageId: string) => void;
  openDirect:    (userId: string) => Promise<ChatSummary>;
  /** Ochiq kanalga obuna bo'lish. */
  joinChannel:   (chatId: string) => Promise<ChatSummary>;
  setActiveChat: (chatId: string | null) => void;
}

const ChatStoreContext = createContext<ChatStore | null>(null);

const newClientId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const ChatStoreProvider = ({ children }: { children: ReactNode }) => {
  const { services: { api, socket } } = useSession();
  const me = useCurrentUser();
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const activeChatRef = useRef<string | null>(null);
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const stateRef = useRef(state);
  stateRef.current = state;

  const refreshChats = useCallback(async () => {
    dispatch({ type: 'chats/loaded', chats: await api.listChats() });
  }, [api]);

  const loadMessages = useCallback(async (chatId: string, older = false) => {
    const before = older ? stateRef.current.messages[chatId]?.nextCursor ?? undefined : undefined;
    if (older && !before) return;
    const page = await api.listMessages(chatId, { before });
    dispatch({ type: 'messages/loaded', chatId, page, older });
  }, [api]);

  const upsertFromServer = useCallback((chatId: string) => {
    api.getChat(chatId).then(
      (chat) => dispatch({ type: 'chat/upserted', chat }),
      () => undefined,
    );
  }, [api]);

  const deliver = useCallback(async (message: LocalMessage) => {
    const clientId = message.clientId ?? newClientId();
    try {
      const payload = { chatId: message.chatId, content: message.content, clientId };
      const saved = socket.isConnected()
        ? await socket.sendMessage(payload)
        : await api.sendMessage(message.chatId, { content: message.content, clientId });
      dispatch({ type: 'message/received', message: saved, clientId, myId: me.id, activeChatId: activeChatRef.current });
    } catch {
      dispatch({ type: 'message/local', chatId: message.chatId, clientId, local: 'failed' });
    }
  }, [api, socket, me.id]);

  const sendText = useCallback(async (chatId: string, text: string) => {
    const content = text.trim();
    if (!content) return;
    const clientId = newClientId();
    const optimistic: LocalMessage = {
      id:         `local:${clientId}`,
      chatId,
      senderId:   me.id,
      type:       'text',
      content,
      attachment: null,
      createdAt:  new Date().toISOString(),
      editedAt:   null,
      clientId,
      local:      'pending',
    };
    dispatch({ type: 'message/optimistic', message: optimistic });
    await deliver(optimistic);
  }, [deliver, me.id]);

  const resend = useCallback(async (message: LocalMessage) => {
    if (message.local !== 'failed' || !message.clientId) return;
    dispatch({ type: 'message/local', chatId: message.chatId, clientId: message.clientId, local: 'pending' });
    await deliver(message);
  }, [deliver]);

  const setTyping = useCallback((chatId: string, isTyping: boolean) => socket.setTyping(chatId, isTyping), [socket]);

  const markRead = useCallback((chatId: string, messageId: string) => {
    socket.markRead(chatId, messageId).then(
      ({ lastReadAt }) => dispatch({ type: 'read/updated', chatId, userId: me.id, lastReadAt, myId: me.id }),
      () => undefined,
    );
  }, [socket, me.id]);

  const openDirect = useCallback(async (userId: string) => {
    const chat = await api.createDirectChat(userId);
    dispatch({ type: 'chat/upserted', chat });
    return chat;
  }, [api]);

  const joinChannel = useCallback(async (chatId: string) => {
    const chat = await api.joinChannel(chatId);
    dispatch({ type: 'chat/upserted', chat });
    return chat;
  }, [api]);

  const setActiveChat = useCallback((chatId: string | null) => {
    activeChatRef.current = chatId;
  }, []);

  // Real vaqt voqealari.
  useEffect(() => {
    const timers = typingTimers.current;
    const offs = [
      socket.on('message:new', ({ message, clientId }) => {
        if (!stateRef.current.chats[message.chatId]) upsertFromServer(message.chatId);
        dispatch({ type: 'message/received', message, clientId, myId: me.id, activeChatId: activeChatRef.current });
      }),
      socket.on('message:updated', ({ message }) => dispatch({ type: 'message/updated', message })),
      socket.on('message:deleted', ({ chatId, messageId }) => {
        dispatch({ type: 'message/deleted', chatId, messageId });
        // O'qilmaganlar soni / oxirgi xabar o'zgargan bo'lishi mumkin.
        upsertFromServer(chatId);
      }),
      socket.on('message:read', ({ chatId, userId, lastReadAt }) =>
        dispatch({ type: 'read/updated', chatId, userId, lastReadAt, myId: me.id })),
      socket.on('typing', ({ chatId, userId, isTyping }) => {
        const key = `${chatId}:${userId}`;
        clearTimeout(timers.get(key));
        dispatch({ type: 'typing', chatId, userId, isTyping });
        if (isTyping) {
          timers.set(key, setTimeout(() => dispatch({ type: 'typing', chatId, userId, isTyping: false }), TYPING_TTL_MS));
        }
      }),
      socket.on('presence:state', ({ online }) => dispatch({ type: 'presence/state', online })),
      socket.on('presence:update', ({ userId, online, lastSeenAt }) =>
        dispatch({ type: 'presence/update', userId, online, lastSeenAt })),
      socket.on('chat:updated', ({ chatId }) => upsertFromServer(chatId)),
      socket.on('chat:deleted', ({ chatId }) => dispatch({ type: 'chat/removed', chatId })),
      socket.on('chat:member', ({ chatId, userId, action }) => {
        if (action === 'removed' && userId === me.id) dispatch({ type: 'chat/removed', chatId });
        else upsertFromServer(chatId);
      }),
      // (Qayta) ulanganda uzilish vaqtidagi o'zgarishlar yuklanadi.
      socket.onConnectionChange((connected) => {
        if (!connected) return;
        refreshChats().catch(() => undefined);
        const active = activeChatRef.current;
        if (active) loadMessages(active).catch(() => undefined);
      }),
    ];
    return () => {
      offs.forEach((off) => off());
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [socket, me.id, refreshChats, loadMessages, upsertFromServer]);

  const value = useMemo<ChatStore>(
    () => ({ state, refreshChats, loadMessages, sendText, resend, setTyping, markRead, openDirect, joinChannel, setActiveChat }),
    [state, refreshChats, loadMessages, sendText, resend, setTyping, markRead, openDirect, joinChannel, setActiveChat],
  );
  return <ChatStoreContext.Provider value={value}>{children}</ChatStoreContext.Provider>;
};

export const useChatStore = (): ChatStore => {
  const ctx = useContext(ChatStoreContext);
  if (!ctx) throw new Error('useChatStore ChatStoreProvider ichida ishlatilishi kerak');
  return ctx;
};
