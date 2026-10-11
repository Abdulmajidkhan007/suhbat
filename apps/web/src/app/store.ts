// src/app/store.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer     from '../features/auth/authSlice';
import chatsReducer    from '../features/chats/chatsSlice';
import messagesReducer from '../features/messages/messagesSlice';
import themeReducer    from '../features/theme/themeSlice';
import uiReducer       from '../features/ui/uiSlice';
import presenceReducer from '../features/presence/presenceSlice';

export const store = configureStore({
  reducer: {
    auth:     authReducer,
    chats:    chatsReducer,
    messages: messagesReducer,
    theme:    themeReducer,
    ui:       uiReducer,
    presence: presenceReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
