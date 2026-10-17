import { AppState } from 'react-native';
import type { UiState } from './controller';

/** Oynasiz (headless) ishga tushganda AppState `active` emas — bildirishnoma ko'rsatiladi. */
export const appUiState: UiState = {
  isForeground: () => AppState.currentState === 'active',
};
