import { REPLY_PREVIEW_MAX } from '@suhbat/core';
import type { ChatRole, ChatSummary, CreateChannelInput, CreateGroupInput, MessageReply, UpdateChatInput } from '@suhbat/core';
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
  /** `replyTo` — javob berilayotgan xabar (shu chatdan). */
  sendText:      (chatId: string, text: string, replyTo?: LocalMessage) => Promise<void>;
  resend:        (message: LocalMessage) => Promise<void>;
  setTyping:     (chatId: string, isTyping: boolean) => void;
  markRead:      (chatId: string, messageId: string) => void;
  openDirect:    (userId: string) => Promise<ChatSummary>;
  /** Ochiq kanalga obuna bo'lish. */
  joinChannel:   (chatId: string) => Promise<ChatSummary>;
  setActiveChat: (chatId: string | null) => void;
  /** Chat holatda bo'lmasa serverdan olib qo'yadi (topilmasa — xato). */
  ensureChat:    (chatId: string) => Promise<void>;
  /** O'z matnli xabarini tahrirlash. */
  editMessage:   (chatId: string, messageId: string, content: string) => Promise<void>;
  /** O'z xabarini (yoki admin sifatida birovnikini) o'chirish. */
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  /** Xato bilan qolgan (yuborilmagan) xabarni ro'yxatdan olib tashlash. */
  discardLocal:  (chatId: string, clientId: string) => void;
  createGroup:   (input: CreateGroupInput) => Promise<ChatSummary>;
  createChannel: (input: CreateChannelInput) => Promise<ChatSummary>;
  updateChat:    (chatId: string, input: UpdateChatInput) => Promise<ChatSummary>;
  addMembers:    (chatId: string, userIds: string[]) => Promise<ChatSummary>;
  removeMember:  (chatId: string, userId: string) => Promise<void>;
  setMemberRole: (chatId: string, userId: string, role: Exclude<ChatRole, 'owner'>) => Promise<void>;
  /** Guruh/kanaldan chiqish. */
  leaveChat:     (chatId: string) => Promise<void>;
  /** Guruh/kanalni o'chirish (faqat ega). */
  deleteChat:    (chatId: string) => Promise<void>;
}

const ChatStoreContext = createContext<ChatStore | null>(null);

/** Optimistik xabar uchun javob ko'rinishi (server ham xuddi shunday qaytaradi). */
const replyPreview = (m: LocalMessage): MessageReply => ({
  id:       m.id,
  senderId: m.senderId,
  content:  truncateText(m.content, REPLY_PREVIEW_MAX),
  kind:     m.attachment?.kind ?? null,
  deleted:  false,
});

const truncateText = (text: string, max: number): string => {
  let out = '';
  for (const ch of text) {
    if (out.length + ch.length > max) break;
    out += ch;
  }
  return out;
};

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
      const replyToId = message.replyToId;
      const payload = { chatId: message.chatId, content: message.content, clientId, ...(replyToId ? { replyToId } : {}) };
      const saved = socket.isConnected()
        ? await socket.sendMessage(payload)
        : await api.sendMessage(message.chatId, { content: message.content, clientId, ...(replyToId ? { replyToId } : {}) });
      dispatch({ type: 'message/received', message: saved, clientId, myId: me.id, activeChatId: activeChatRef.current });
    } catch {
      dispatch({ type: 'message/local', chatId: message.chatId, clientId, local: 'failed' });
    }
  }, [api, socket, me.id]);

  const sendText = useCallback(async (chatId: string, text: string, replyTo?: LocalMessage) => {
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
      ...(replyTo ? { replyToId: replyTo.id, replyTo: replyPreview(replyTo) } : {}),
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

  const ensureChat = useCallback(async (chatId: string) => {
    if (stateRef.current.chats[chatId]) return;
    dispatch({ type: 'chat/upserted', chat: await api.getChat(chatId) });
  }, [api]);

  const editMessage = useCallback(async (chatId: string, messageId: string, content: string) => {
    const message = socket.isConnected()
      ? await socket.editMessage(chatId, messageId, content)
      : await api.editMessage(chatId, messageId, content);
    dispatch({ type: 'message/updated', message });
  }, [api, socket]);

  const deleteMessage = useCallback(async (chatId: string, messageId: string) => {
    if (socket.isConnected()) await socket.deleteMessage(chatId, messageId);
    else await api.deleteMessage(chatId, messageId);
    dispatch({ type: 'message/deleted', chatId, messageId });
    upsertFromServer(chatId);
  }, [api, socket, upsertFromServer]);

  const discardLocal = useCallback((chatId: string, clientId: string) => {
    dispatch({ type: 'message/discarded', chatId, clientId });
  }, []);

  const upserted = useCallback((chat: ChatSummary) => {
    dispatch({ type: 'chat/upserted', chat });
    return chat;
  }, []);

  const createGroup = useCallback(async (input: CreateGroupInput) => upserted(await api.createGroup(input)), [api, upserted]);
  const createChannel = useCallback(async (input: CreateChannelInput) => upserted(await api.createChannel(input)), [api, upserted]);
  const updateChat = useCallback(
    async (chatId: string, input: UpdateChatInput) => upserted(await api.updateChat(chatId, input)),
    [api, upserted],
  );
  const addMembers = useCallback(
    async (chatId: string, userIds: string[]) => upserted(await api.addMembers(chatId, userIds)),
    [api, upserted],
  );
  const removeMember = useCallback(async (chatId: string, userId: string) => {
    await api.removeMember(chatId, userId);
    upsertFromServer(chatId);
  }, [api, upsertFromServer]);
  const setMemberRole = useCallback(async (chatId: string, userId: string, role: Exclude<ChatRole, 'owner'>) => {
    await api.setMemberRole(chatId, userId, role);
    upsertFromServer(chatId);
  }, [api, upsertFromServer]);
  const leaveChat = useCallback(async (chatId: string) => {
    await api.leaveChat(chatId);
    dispatch({ type: 'chat/removed', chatId });
  }, [api]);
  const deleteChat = useCallback(async (chatId: string) => {
    await api.deleteChat(chatId);
    dispatch({ type: 'chat/removed', chatId });
  }, [api]);

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
    () => ({
      state, refreshChats, loadMessages, sendText, resend, setTyping, markRead, openDirect, joinChannel, setActiveChat,
      ensureChat, editMessage, deleteMessage, discardLocal, createGroup, createChannel, updateChat, addMembers, removeMember,
      setMemberRole, leaveChat, deleteChat,
    }),
    [
      state, refreshChats, loadMessages, sendText, resend, setTyping, markRead, openDirect, joinChannel, setActiveChat,
      ensureChat, editMessage, deleteMessage, discardLocal, createGroup, createChannel, updateChat, addMembers, removeMember,
      setMemberRole, leaveChat, deleteChat,
    ],
  );
  return <ChatStoreContext.Provider value={value}>{children}</ChatStoreContext.Provider>;
};

export const useChatStore = (): ChatStore => {
  const ctx = useContext(ChatStoreContext);
  if (!ctx) throw new Error('useChatStore ChatStoreProvider ichida ishlatilishi kerak');
  return ctx;
};
