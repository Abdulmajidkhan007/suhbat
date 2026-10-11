// src/features/presence/presenceSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PresenceState } from '../../types';

const initialState: PresenceState = {
  onlineUsers: {},
};

const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    setPresence(state, action: PayloadAction<Record<string, boolean>>) {
      state.onlineUsers = action.payload;
    },
    updateUserPresence(
      state,
      action: PayloadAction<{ uid: string; isOnline: boolean }>,
    ) {
      state.onlineUsers[action.payload.uid] = action.payload.isOnline;
    },
  },
});

export const { setPresence, updateUserPresence } = presenceSlice.actions;
export default presenceSlice.reducer;
