// src/features/chats/chatsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatsState, Chat, Message } from '../../types';

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
      chat.lastMessage = { content: message.content, senderId: message.senderId, createdAt: message.createdAt };
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
  bumpSyncEpoch,
  resetChats,
} = chatsSlice.actions;
export default chatsSlice.reducer;
