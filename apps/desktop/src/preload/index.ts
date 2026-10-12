import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge } from '@suhbat/client';
import type { TokenPair } from '@suhbat/core';

// Sandbox'langan preload faqat `electron` ni require qila oladi (nisbiy import yo'q),
// shuning uchun kanal nomlari `src/main/ipc-channels.ts` dan ko'chirilgan — ikkalasini birga o'zgartiring.
const IPC = {
  tokensGet:   'suhbat:tokens:get',
  tokensSet:   'suhbat:tokens:set',
  tokensClear: 'suhbat:tokens:clear',
} as const;

// Faqat minimal API: platforma nomi va tokenlar (OS xavfsiz saqlashi). Node/Electron
// ob'ektlari sahifaga berilmaydi.
const bridge: DesktopBridge = {
  platform: process.platform,
  tokens: {
    get:   () => ipcRenderer.invoke(IPC.tokensGet) as Promise<TokenPair | null>,
    set:   (t) => ipcRenderer.invoke(IPC.tokensSet, t) as Promise<void>,
    clear: () => ipcRenderer.invoke(IPC.tokensClear) as Promise<void>,
  },
};

contextBridge.exposeInMainWorld('suhbatDesktop', bridge);
