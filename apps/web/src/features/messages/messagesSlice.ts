// src/features/messages/messagesSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MessagesState, Message } from '../../types';

const initialState: MessagesState = {
  messagesByChatId:     {},
  loadingByChatId:      {},
  errorByChatId:        {},
  nextCursorByChatId:   {},
  loadingOlderByChatId: {},
};

const byTime = (a: Message, b: Message) => a.createdAt - b.createdAt;

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    /** Birinchi sahifa. Hali yuborilayotgan optimistik xabarlar saqlanadi. */
    setMessages(
      state,
      action: PayloadAction<{ chatId: string; messages: Message[]; nextCursor: string | null }>,
    ) {
      const { chatId, messages, nextCursor } = action.payload;
      const ids = new Set(messages.map((m) => m.id));
      const pending = (state.messagesByChatId[chatId] ?? []).filter((m) => m.isOptimistic && !ids.has(m.id));
      state.messagesByChatId[chatId]   = [...messages, ...pending];
      state.nextCursorByChatId[chatId] = nextCursor;
      state.loadingByChatId[chatId]    = false;
      state.errorByChatId[chatId]      = null;
    },
    prependOlder(
      state,
      action: PayloadAction<{ chatId: string; messages: Message[]; nextCursor: string | null }>,
    ) {
      const { chatId, messages, nextCursor } = action.payload;
      const current = state.messagesByChatId[chatId] ?? [];
      const ids = new Set(current.map((m) => m.id));
      state.messagesByChatId[chatId]     = [...messages.filter((m) => !ids.has(m.id)), ...current];
      state.nextCursorByChatId[chatId]   = nextCursor;
      state.loadingOlderByChatId[chatId] = false;
    },
    setMessagesLoading(state, action: PayloadAction<{ chatId: string; loading: boolean }>) {
      state.loadingByChatId[action.payload.chatId] = action.payload.loading;
    },
    setLoadingOlder(state, action: PayloadAction<{ chatId: string; loading: boolean }>) {
      state.loadingOlderByChatId[action.payload.chatId] = action.payload.loading;
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
    /**
     * Serverdan kelgan xabar (ack yoki `message:new`). `clientId` optimistik
     * xabarga mos kelsa — o'rniga qo'yiladi; id allaqachon bo'lsa — takrorlanmaydi.
     */
    messageReceived(state, action: PayloadAction<{ message: Message; clientId?: string }>) {
      const { message, clientId } = action.payload;
      const list = state.messagesByChatId[message.chatId];
      if (!list) return; // chat hali ochilmagan — tarix ochilganda yuklanadi
      const withoutTemp = clientId ? list.filter((m) => m.id !== clientId) : list;
      const existing = withoutTemp.findIndex((m) => m.id === message.id);
      if (existing >= 0) {
        withoutTemp[existing] = { ...message, status: withoutTemp[existing].status === 'read' ? 'read' : message.status };
        state.messagesByChatId[message.chatId] = withoutTemp;
        return;
      }
      const last = withoutTemp[withoutTemp.length - 1];
      withoutTemp.push(message);
      if (last && last.createdAt > message.createdAt && !last.isOptimistic) withoutTemp.sort(byTime);
      state.messagesByChatId[message.chatId] = withoutTemp;
    },
    /** Tahrirlangan xabar (`message:updated` yoki REST/ack javobi). */
    messageUpdated(state, action: PayloadAction<Message>) {
      const list = state.messagesByChatId[action.payload.chatId];
      const idx = list?.findIndex((m) => m.id === action.payload.id) ?? -1;
      if (!list || idx < 0) return;
      list[idx] = { ...list[idx], content: action.payload.content, editedAt: action.payload.editedAt, updatedAt: action.payload.updatedAt };
    },
    /** O'chirilgan xabar (soft-delete serverda) ro'yxatdan olib tashlanadi. */
    messageDeleted(state, action: PayloadAction<{ chatId: string; messageId: string }>) {
      const { chatId, messageId } = action.payload;
      const list = state.messagesByChatId[chatId];
      if (!list) return;
      state.messagesByChatId[chatId] = list.filter((m) => m.id !== messageId);
      // Unga berilgan javoblarda — "O'chirilgan xabar".
      for (const m of state.messagesByChatId[chatId]) {
        if (m.replyTo?.id === messageId) m.replyTo = { ...m.replyTo, content: '', kind: null, deleted: true };
      }
    },
    markMessageFailed(state, action: PayloadAction<{ chatId: string; tempId: string }>) {
      const msg = state.messagesByChatId[action.payload.chatId]?.find((m) => m.id === action.payload.tempId);
      if (msg) msg.status = 'failed';
    },
    /** Qayta yuborish boshlandi (xato holatidan). */
    markMessageSending(state, action: PayloadAction<{ chatId: string; tempId: string }>) {
      const msg = state.messagesByChatId[action.payload.chatId]?.find((m) => m.id === action.payload.tempId);
      if (msg) msg.status = 'sending';
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
      delete state.nextCursorByChatId[action.payload];
      delete state.loadingOlderByChatId[action.payload];
    },
    resetMessages() {
      return initialState;
    },
  },
});

export const {
  setMessages,
  prependOlder,
  setMessagesLoading,
  setLoadingOlder,
  setMessagesError,
  appendOptimisticMessage,
  messageReceived,
  messageUpdated,
  messageDeleted,
  markMessageFailed,
  markMessageSending,
  removeOptimisticMessage,
  clearMessages,
  resetMessages,
} = messagesSlice.actions;
export default messagesSlice.reducer;
