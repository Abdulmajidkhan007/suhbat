import { app, BrowserWindow, ipcMain, net, protocol, safeStorage, session, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_ORIGIN, APP_SCHEME, CONTENT_SECURITY_POLICY, resolveAppFile } from './app-protocol';
import { IPC } from './ipc-channels';
import { isMediaPermissionAllowed } from './permissions';
import { createTokenVault, isTokenPair } from './secure-token-store';
import type { BlobFile, Cipher } from './secure-token-store';

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

/** Dev: `SUHBAT_DEV_URL=http://localhost:3000` — Vite dev serveri (faqat qadoqlanmagan ilovada). */
const devUrl = app.isPackaged ? undefined : process.env.SUHBAT_DEV_URL;
const webRoot = app.isPackaged
  ? path.join(process.resourcesPath, 'web')
  : path.resolve(__dirname, '../../../web/dist');

const cipher: Cipher = {
  // Linux'da kalit ombori yo'q bo'lsa Electron `basic_text` ga tushadi — bu shifrlash emas.
  isAvailable: () =>
    safeStorage.isEncryptionAvailable() &&
    !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text'),
  encrypt: (plain) => safeStorage.encryptString(plain),
  decrypt: (data) => safeStorage.decryptString(data),
};

const tokenFile = (): BlobFile => {
  const file = path.join(app.getPath('userData'), 'tokens.bin');
  return {
    read:   () => (fs.existsSync(file) ? fs.readFileSync(file) : null),
    write:  (data) => fs.writeFileSync(file, data, { mode: 0o600 }),
    remove: () => fs.rmSync(file, { force: true }),
  };
};

const isOwnPage = (url: string): boolean => (devUrl ? url.startsWith(devUrl) : url.startsWith(`${APP_ORIGIN}/`));

function registerIpc() {
  const vault = createTokenVault(cipher, tokenFile());
  // Faqat bizning sahifamizdan kelgan so'rovlar.
  const guard = (e: Electron.IpcMainInvokeEvent) => {
    if (!e.senderFrame || !isOwnPage(e.senderFrame.url)) throw new Error('Ruxsat yo\'q');
  };
  ipcMain.handle(IPC.tokensGet, (e) => { guard(e); return vault.get(); });
  ipcMain.handle(IPC.tokensSet, (e, tokens: unknown) => {
    guard(e);
    if (!isTokenPair(tokens)) throw new Error('Noto\'g\'ri token shakli');
    vault.set(tokens);
  });
  ipcMain.handle(IPC.tokensClear, (e) => { guard(e); vault.clear(); });
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    const file = resolveAppFile(webRoot, request.url);
    if (!file) return new Response('Not found', { status: 404 });
    const res = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(res.headers);
    headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    return new Response(res.body, { status: res.status, headers });
  });
}

function hardenSession() {
  // Faqat mikrofon va kamera (ovozli xabar, qo'ng'iroq) — o'z sahifamiz uchun; boshqasi rad.
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined;
    callback(isMediaPermissionAllowed(permission, isOwnPage(wc.getURL()), mediaTypes));
  });
  // Sinxron tekshiruvlar (masalan, `enumerateDevices` qurilma nomlari uchun) — xuddi shu qoida.
  session.defaultSession.setPermissionCheckHandler((wc, permission) =>
    isMediaPermissionAllowed(permission, wc !== null && isOwnPage(wc.getURL())),
  );
}

function createWindow() {
  const win = new BrowserWindow({
    width:     1200,
    height:    800,
    minWidth:  360,
    minHeight: 480,
    title:     'suhbat',
    show:      false,
    webPreferences: {
      preload:          path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          true,
      webSecurity:      true,
    },
  });
  win.once('ready-to-show', () => win.show());

  // Tashqi havolalar — tizim brauzerida (faqat http/https); ilova ichida navigatsiya yo'q.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!isOwnPage(url)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });

  void win.loadURL(devUrl ?? `${APP_ORIGIN}/`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  void app.whenReady().then(() => {
    registerIpc();
    registerAppProtocol();
    hardenSession();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
