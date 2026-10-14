// src/features/ui/uiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UIState } from '../../types';

const initialState: UIState = {
  composerHeight: 56,
  activePanel:    'chats',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActivePanel(state, action: PayloadAction<UIState['activePanel']>) {
      state.activePanel = action.payload;
    },
    setComposerHeight(state, action: PayloadAction<number>) {
      state.composerHeight = action.payload;
    },
  },
});

export const { setActivePanel, setComposerHeight } =
  uiSlice.actions;
export default uiSlice.reducer;
