// src/app/store.ts
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import authReducer     from '../features/auth/authSlice';
import chatsReducer    from '../features/chats/chatsSlice';
import messagesReducer from '../features/messages/messagesSlice';
import themeReducer    from '../features/theme/themeSlice';
import uiReducer       from '../features/ui/uiSlice';
import presenceReducer from '../features/presence/presenceSlice';

const rootReducer = combineReducers({
  auth:     authReducer,
  chats:    chatsReducer,
  messages: messagesReducer,
  theme:    themeReducer,
  ui:       uiReducer,
  presence: presenceReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/** Alohida nusxa (testlarda `preloadedState` bilan); ilovada — pastdagi `store`. */
export const createAppStore = (preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
  });

export const store = createAppStore();

export type AppDispatch = typeof store.dispatch;
