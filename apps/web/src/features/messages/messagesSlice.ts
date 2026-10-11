// src/features/messages/messagesSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MessagesState, Message } from '../../types';

const initialState: MessagesState = {
  messagesByChatId: {},
  loadingByChatId:  {},
  errorByChatId:    {},
};

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    setMessages(state, action: PayloadAction<{ chatId: string; messages: Message[] }>) {
      const { chatId, messages } = action.payload;
      state.messagesByChatId[chatId] = messages;
      state.loadingByChatId[chatId]  = false;
      state.errorByChatId[chatId]    = null;
    },
    setMessagesLoading(state, action: PayloadAction<{ chatId: string; loading: boolean }>) {
      state.loadingByChatId[action.payload.chatId] = action.payload.loading;
    },
    setMessagesError(state, action: PayloadAction<{ chatId: string; error: string }>) {
      state.errorByChatId[action.payload.chatId]   = action.payload.error;
      state.loadingByChatId[action.payload.chatId] = false;
    },
    appendOptimisticMessage(state, action: PayloadAction<Message>) {
      const { chatId } = action.payload;
      if (!state.messagesByChatId[chatId]) state.messagesByChatId[chatId] = [];
      state.messagesByChatId[chatId].push(action.payload);
    },
    removeOptimisticMessage(
      state,
      action: PayloadAction<{ chatId: string; tempId: string }>,
    ) {
      const { chatId, tempId } = action.payload;
      if (state.messagesByChatId[chatId]) {
        state.messagesByChatId[chatId] = state.messagesByChatId[chatId].filter(
          (m) => m.id !== tempId,
        );
      }
    },
    clearMessages(state, action: PayloadAction<string>) {
      delete state.messagesByChatId[action.payload];
      delete state.loadingByChatId[action.payload];
      delete state.errorByChatId[action.payload];
    },
  },
});

export const {
  setMessages,
  setMessagesLoading,
  setMessagesError,
  appendOptimisticMessage,
  removeOptimisticMessage,
  clearMessages,
} = messagesSlice.actions;
export default messagesSlice.reducer;
