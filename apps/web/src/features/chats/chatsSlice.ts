// src/features/chats/chatsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatsState, Chat, ChatParticipant, Message, UserRole } from '../../types';
import { messagePreview } from '../../utils/formatters';

const initialState: ChatsState = {
  chats:        [],
  activeChatId: null,
  loading:      true,
  error:        null,
  syncEpoch:    0,
};

const chatsSlice = createSlice({
  name: 'chats',
  initialState,
  reducers: {
    setChats(state, action: PayloadAction<Chat[]>) {
      // "yozmoqda" holati serverdan kelmaydi — qayta yuklashda saqlab qolamiz
      const typing = new Map(state.chats.map((c) => [c.id, c.typingUsers]));
      state.chats   = action.payload.map((c) => ({ ...c, typingUsers: typing.get(c.id) ?? {} }));
      state.loading = false;
      state.error   = null;
    },
    setActiveChat(state, action: PayloadAction<string | null>) {
      state.activeChatId = action.payload;
    },
    setChatsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setChatsError(state, action: PayloadAction<string | null>) {
      state.error   = action.payload;
      state.loading = false;
    },
    upsertChat(state, action: PayloadAction<Chat>) {
      const idx = state.chats.findIndex((c) => c.id === action.payload.id);
      if (idx >= 0) {
        state.chats[idx] = { ...action.payload, typingUsers: state.chats[idx].typingUsers };
      } else {
        state.chats.unshift(action.payload);
      }
    },
    /** Yangi xabar: oxirgi xabar, o'qilmaganlar soni, yozuvchi holati. */
    chatMessageReceived(
      state,
      action: PayloadAction<{ message: Message; currentUid: string; countUnread: boolean }>,
    ) {
      const { message, currentUid, countUnread } = action.payload;
      const chat = state.chats.find((c) => c.id === message.chatId);
      if (!chat) return;
      if (chat.lastMessage && chat.lastMessage.createdAt > message.createdAt) return;
      chat.lastMessage = {
        content:   messagePreview(message.content, message.type),
        senderId:  message.senderId,
        createdAt: message.createdAt,
      };
      chat.updatedAt   = message.createdAt;
      delete chat.typingUsers[message.senderId];
      if (message.senderId !== currentUid && countUnread) chat.unreadCount += 1;
    },
    setTyping(state, action: PayloadAction<{ chatId: string; userId: string; isTyping: boolean }>) {
      const chat = state.chats.find((c) => c.id === action.payload.chatId);
      if (!chat) return;
      if (action.payload.isTyping) chat.typingUsers[action.payload.userId] = true;
      else delete chat.typingUsers[action.payload.userId];
    },
    memberRead(
      state,
      action: PayloadAction<{ chatId: string; userId: string; lastReadAt: number; currentUid: string }>,
    ) {
      const { chatId, userId, lastReadAt, currentUid } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      const member = chat?.participantDetails[userId];
      if (!chat || !member) return;
      if (member.lastReadAt == null || member.lastReadAt < lastReadAt) member.lastReadAt = lastReadAt;
      if (userId === currentUid) chat.unreadCount = 0;
    },
    /** Oxirgi xabar tahrirlangan bo'lsa ro'yxatdagi matni ham yangilanadi. */
    lastMessageEdited(state, action: PayloadAction<{ chatId: string; senderId: string; createdAt: number; content: string }>) {
      const { chatId, senderId, createdAt, content } = action.payload;
      const last = state.chats.find((c) => c.id === chatId)?.lastMessage;
      if (last && last.senderId === senderId && last.createdAt === createdAt) last.content = content;
    },
    /** `chat:updated` — nom, tavsif, ochiqlik. */
    chatUpdated(
      state,
      action: PayloadAction<{ chatId: string; title: string | null; description: string | null; isPublic: boolean; updatedAt: number }>,
    ) {
      const { chatId, title, description, isPublic, updatedAt } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (!chat) return;
      if (title) chat.name = title;
      chat.description = description ?? undefined;
      chat.isPublic    = isPublic;
      chat.updatedAt   = updatedAt;
    },
    /** `chat:member` — a'zo qo'shildi / chiqdi / roli o'zgardi. */
    chatMemberChanged(
      state,
      action: PayloadAction<{
        chatId: string; userId: string; action: 'added' | 'removed' | 'role';
        participant: ChatParticipant | null; memberCount: number; currentUid: string;
      }>,
    ) {
      const { chatId, userId, action: kind, participant, memberCount, currentUid } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (!chat) return;
      if (kind === 'removed' && userId === currentUid) {
        state.chats = state.chats.filter((c) => c.id !== chatId);
        if (state.activeChatId === chatId) state.activeChatId = null;
        return;
      }
      chat.memberCount = memberCount;
      if (kind === 'removed') {
        delete chat.participantDetails[userId];
      } else if (participant) {
        chat.participantDetails[userId] = { ...chat.participantDetails[userId], ...participant };
      }
      if (kind === 'removed') chat.participants = chat.participants.filter((id) => id !== userId);
      else if (!chat.participants.includes(userId)) chat.participants.push(userId);
      const role: UserRole | undefined = chat.participantDetails[userId]?.role;
      chat.admins = Object.values(chat.participantDetails).filter((p) => p.role === 'admin').map((p) => p.uid);
      if (kind === 'role' && role) {
        if (userId === currentUid) chat.myRole = role;
        if (role === 'owner') chat.ownerId = userId;
      }
    },
    removeChat(state, action: PayloadAction<string>) {
      state.chats = state.chats.filter((c) => c.id !== action.payload);
      if (state.activeChatId === action.payload) state.activeChatId = null;
    },
    bumpSyncEpoch(state) {
      state.syncEpoch += 1;
    },
    resetChats() {
      return initialState;
    },
  },
});

export const {
  setChats,
  setActiveChat,
  setChatsLoading,
  setChatsError,
  upsertChat,
  chatMessageReceived,
  setTyping,
  memberRead,
  lastMessageEdited,
  chatUpdated,
  chatMemberChanged,
  removeChat,
  bumpSyncEpoch,
  resetChats,
} = chatsSlice.actions;
export default chatsSlice.reducer;
