// src/features/chats/chatsSelectors.ts
import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../app/store';

export const selectAllChats    = (s: RootState) => s.chats.chats;
export const selectActiveChatId = (s: RootState) => s.chats.activeChatId;
export const selectChatsLoading = (s: RootState) => s.chats.loading;
export const selectChatsError   = (s: RootState) => s.chats.error;

export const selectActiveChat = createSelector(
  selectAllChats,
  selectActiveChatId,
  (chats, id) => chats.find((c) => c.id === id) ?? null,
);

export const selectSortedChats = createSelector(selectAllChats, (chats) =>
  [...chats].sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ?? a.createdAt;
    const bTime = b.lastMessage?.createdAt ?? b.createdAt;
    return bTime - aTime;
  }),
);
