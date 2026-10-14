import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createAppStore } from '../app/store';
import type { RootState } from '../app/store';
import type { AppUser, Chat } from '../types';

export const ME: AppUser = {
  uid: 'me', email: 'me@test.uz', displayName: 'Ali Valiyev', photoURL: null, bio: null,
  createdAt: 1, lastSeen: 1, isOnline: false,
};

export const makeChat = (over: Partial<Chat> = {}): Chat => ({
  id: 'c1', name: 'Vali', type: 'direct', photoURL: null, participants: ['me', 'v'], myRole: 'member',
  participantDetails: {
    me: { uid: 'me', displayName: 'Ali Valiyev', photoURL: null, isOnline: false, lastSeen: 0, lastReadAt: null },
    v:  { uid: 'v', displayName: 'Vali', photoURL: null, isOnline: false, lastSeen: 0, lastReadAt: null },
  },
  lastMessage: null, unreadCount: 0, createdAt: 1, updatedAt: 1, typingUsers: {},
  ...over,
});

/** Redux `Provider` bilan (joriy foydalanuvchi — `ME`) render qiladi. */
export const renderWithStore = (ui: ReactElement, preloaded: Partial<RootState> = {}) => {
  const store = createAppStore({
    auth: { user: ME, loading: false, error: null, initialized: true },
    ...preloaded,
  });
  return { store, ...render(<Provider store={store}>{ui}</Provider>) };
};
