import { toMillis } from '@suhbat/core';
import type { ChatMember, ChatSummary, Message, MessagePage } from '@suhbat/core';

/** Optimistik xabar: server tasdiqlaguncha `pending`, xato bo'lsa `failed`. */
export interface LocalMessage extends Message {
  clientId?: string;
  local?:    'pending' | 'failed';
}

export interface ChatMessages {
  /** Xronologik (eskisidan yangisiga). */
  items:      LocalMessage[];
  nextCursor: string | null;
  loaded:     boolean;
}

export interface ChatState {
  chats:    Record<string, ChatSummary>;
  messages: Record<string, ChatMessages>;
  /** chatId → yozayotgan foydalanuvchilar. */
  typing:   Record<string, string[]>;
  online:   Record<string, boolean>;
}

export const initialChatState: ChatState = { chats: {}, messages: {}, typing: {}, online: {} };

export type ChatAction =
  | { type: 'chats/loaded'; chats: ChatSummary[] }
  | { type: 'chat/upserted'; chat: ChatSummary }
  | { type: 'chat/removed'; chatId: string }
  | { type: 'messages/loaded'; chatId: string; page: MessagePage; older: boolean }
  | { type: 'message/optimistic'; message: LocalMessage }
  | { type: 'message/local'; chatId: string; clientId: string; local: 'pending' | 'failed' }
  | { type: 'message/received'; message: Message; clientId?: string; myId: string; activeChatId: string | null }
  | { type: 'message/updated'; message: Message }
  | { type: 'message/deleted'; chatId: string; messageId: string }
  | { type: 'read/updated'; chatId: string; userId: string; lastReadAt: string; myId: string }
  | { type: 'typing'; chatId: string; userId: string; isTyping: boolean }
  | { type: 'presence/state'; online: string[] }
  | { type: 'presence/update'; userId: string; online: boolean; lastSeenAt: string | null };

const byTime = (a: Message, b: Message) => (toMillis(a.createdAt) ?? 0) - (toMillis(b.createdAt) ?? 0);

const mergeMessages = (current: LocalMessage[], incoming: Message[]): LocalMessage[] => {
  const map = new Map<string, LocalMessage>();
  for (const m of current) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort(byTime);
};

const updateMembers = (
  chat: ChatSummary,
  userId: string,
  patch: (m: ChatMember) => ChatMember,
): ChatSummary => ({
  ...chat,
  members: chat.members.map((m) => (m.user.id === userId ? patch(m) : m)),
});

/** Ro'yxat tartibi: oxirgi faollik (oxirgi xabar yoki yaratilgan vaqt) bo'yicha. */
export const sortedChats = (state: ChatState): ChatSummary[] =>
  Object.values(state.chats).sort((a, b) => {
    const ta = toMillis(a.lastMessage?.createdAt ?? a.updatedAt) ?? 0;
    const tb = toMillis(b.lastMessage?.createdAt ?? b.updatedAt) ?? 0;
    return tb - ta;
  });

export const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'chats/loaded':
      return { ...state, chats: Object.fromEntries(action.chats.map((c) => [c.id, c])) };

    case 'chat/upserted':
      return { ...state, chats: { ...state.chats, [action.chat.id]: action.chat } };

    case 'chat/removed': {
      const { [action.chatId]: _chat, ...chats } = state.chats;
      const { [action.chatId]: _messages, ...messages } = state.messages;
      return { ...state, chats, messages };
    }

    case 'messages/loaded': {
      const prev = state.messages[action.chatId];
      // Birinchi sahifa (yoki qayta ulangandan keyin) — server holati asosiy: eski sahifalar
      // tashlanadi, faqat tasdiqlanmagan optimistik xabarlar saqlanadi.
      const base = action.older ? prev?.items ?? [] : (prev?.items ?? []).filter((m) => m.local);
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.chatId]: {
            items:      mergeMessages(base, action.page.items),
            nextCursor: action.page.nextCursor,
            loaded:     true,
          },
        },
      };
    }

    case 'message/optimistic': {
      const { chatId } = action.message;
      const prev = state.messages[chatId] ?? { items: [], nextCursor: null, loaded: false };
      return {
        ...state,
        messages: { ...state.messages, [chatId]: { ...prev, items: [...prev.items, action.message] } },
      };
    }

    case 'message/local': {
      const prev = state.messages[action.chatId];
      if (!prev) return state;
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.chatId]: {
            ...prev,
            items: prev.items.map((m) => (m.clientId === action.clientId ? { ...m, local: action.local } : m)),
          },
        },
      };
    }

    case 'message/received': {
      const { message, clientId, myId, activeChatId } = action;
      const prev = state.messages[message.chatId];
      const typing = state.typing[message.chatId]?.filter((id) => id !== message.senderId);
      let next: ChatState = {
        ...state,
        typing: typing ? { ...state.typing, [message.chatId]: typing } : state.typing,
      };
      if (prev) {
        const withoutOptimistic = clientId ? prev.items.filter((m) => m.clientId !== clientId) : prev.items;
        next = {
          ...next,
          messages: { ...next.messages, [message.chatId]: { ...prev, items: mergeMessages(withoutOptimistic, [message]) } },
        };
      }
      const chat = state.chats[message.chatId];
      if (chat) {
        const isNew = !prev?.items.some((m) => m.id === message.id);
        const unread = message.senderId !== myId && message.chatId !== activeChatId && isNew;
        next = {
          ...next,
          chats: {
            ...next.chats,
            [chat.id]: { ...chat, lastMessage: message, unreadCount: chat.unreadCount + (unread ? 1 : 0) },
          },
        };
      }
      return next;
    }

    case 'message/updated': {
      const prev = state.messages[action.message.chatId];
      const chat = state.chats[action.message.chatId];
      return {
        ...state,
        messages: prev
          ? {
              ...state.messages,
              [action.message.chatId]: {
                ...prev,
                items: prev.items.map((m) => (m.id === action.message.id ? action.message : m)),
              },
            }
          : state.messages,
        chats:
          chat && chat.lastMessage?.id === action.message.id
            ? { ...state.chats, [chat.id]: { ...chat, lastMessage: action.message } }
            : state.chats,
      };
    }

    case 'message/deleted': {
      const prev = state.messages[action.chatId];
      if (!prev) return state;
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.chatId]: { ...prev, items: prev.items.filter((m) => m.id !== action.messageId) },
        },
      };
    }

    case 'read/updated': {
      const chat = state.chats[action.chatId];
      if (!chat) return state;
      let updated = updateMembers(chat, action.userId, (m) => ({ ...m, lastReadAt: action.lastReadAt }));
      if (action.userId === action.myId) {
        const readAt = toMillis(action.lastReadAt) ?? 0;
        const items = state.messages[action.chatId]?.items ?? [];
        const unread = items.filter(
          (m) => m.senderId !== action.myId && !m.local && (toMillis(m.createdAt) ?? 0) > readAt,
        ).length;
        updated = { ...updated, unreadCount: unread };
      }
      return { ...state, chats: { ...state.chats, [chat.id]: updated } };
    }

    case 'typing': {
      const current = state.typing[action.chatId] ?? [];
      const without = current.filter((id) => id !== action.userId);
      const list = action.isTyping ? [...without, action.userId] : without;
      return { ...state, typing: { ...state.typing, [action.chatId]: list } };
    }

    case 'presence/state':
      return { ...state, online: Object.fromEntries(action.online.map((id) => [id, true])) };

    case 'presence/update': {
      const online = { ...state.online, [action.userId]: action.online };
      if (action.online) return { ...state, online };
      // Oflayn bo'lganda a'zo `lastSeenAt` yangilanadi ("oxirgi marta ...").
      const chats = Object.fromEntries(
        Object.entries(state.chats).map(([id, c]) => [
          id,
          c.members.some((m) => m.user.id === action.userId)
            ? updateMembers(c, action.userId, (m) => ({ ...m, lastSeenAt: action.lastSeenAt }))
            : c,
        ]),
      );
      return { ...state, online, chats };
    }
  }
};
