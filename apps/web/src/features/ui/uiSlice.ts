// src/features/ui/uiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UIState } from '../../types';

const initialState: UIState = {
  sidebarOpen:    false,
  composerHeight: 56,
  activePanel:    'chats',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    setActivePanel(state, action: PayloadAction<UIState['activePanel']>) {
      state.activePanel = action.payload;
    },
    setComposerHeight(state, action: PayloadAction<number>) {
      state.composerHeight = action.payload;
    },
  },
});

export const { toggleSidebar, setSidebarOpen, setActivePanel, setComposerHeight } =
  uiSlice.actions;
export default uiSlice.reducer;
