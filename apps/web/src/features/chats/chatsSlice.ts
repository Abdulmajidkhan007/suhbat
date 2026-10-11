// src/features/chats/chatsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatsState, Chat } from '../../types';

const initialState: ChatsState = {
  chats:        [],
  activeChatId: null,
  loading:      true,
  error:        null,
};

const chatsSlice = createSlice({
  name: 'chats',
  initialState,
  reducers: {
    setChats(state, action: PayloadAction<Chat[]>) {
      state.chats   = action.payload;
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
        state.chats[idx] = action.payload;
      } else {
        state.chats.unshift(action.payload);
      }
    },
  },
});

export const { setChats, setActiveChat, setChatsLoading, setChatsError, upsertChat } =
  chatsSlice.actions;
export default chatsSlice.reducer;
