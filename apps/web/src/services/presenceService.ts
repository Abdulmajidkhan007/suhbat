// src/services/presenceService.ts
import {
  ref,
  set,
  onValue,
  onDisconnect,
  serverTimestamp,
  off,
  DataSnapshot,
} from 'firebase/database';
import { rtdb } from './firebase';

export const initPresence = (userId: string): (() => void) => {
  if (!rtdb) return () => {};

  const userStatusRef = ref(rtdb, `/presence/${userId}`);
  const connectedRef  = ref(rtdb, '.info/connected');

  const handler = (snap: DataSnapshot) => {
    if (snap.val() === true) {
      onDisconnect(userStatusRef).set({ isOnline: false, lastSeen: serverTimestamp() });
      set(userStatusRef, { isOnline: true, lastSeen: serverTimestamp() });
    }
  };

  onValue(connectedRef, handler);
  return () => off(connectedRef, 'value', handler);
};

export const subscribeToPresence = (
  userIds: string[],
  callback: (presenceMap: Record<string, boolean>) => void,
): (() => void) => {
  if (!rtdb) {
    callback({});
    return () => {};
  }

  const listeners: Array<() => void> = [];
  const presenceMap: Record<string, boolean> = {};

  userIds.forEach((uid) => {
    const userRef = ref(rtdb!, `/presence/${uid}`);
    const handler = (snap: DataSnapshot) => {
      presenceMap[uid] = snap.val()?.isOnline ?? false;
      callback({ ...presenceMap });
    };
    onValue(userRef, handler);
    listeners.push(() => off(userRef, 'value', handler));
  });

  return () => listeners.forEach((unsub) => unsub());
};
