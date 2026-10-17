import type { SocketClient } from '@suhbat/client';
import { createConnectionKeeper } from '../services/connectionKeeper';
import { createFakeServices } from '../test/fakeServices';
import { CHAT_ID, directChat, message, ME, member, PEER } from '../test/fixtures';
import { callTag, createBackgroundController, SETTINGS_TTL_MS } from './controller';
import type { BackgroundNative } from './native';

const flush = () => new Promise<void>((r) => setImmediate(r));

const fakeNative = (enabled = false): BackgroundNative & { [K in 'showNotification' | 'cancelNotification' | 'startService' | 'stopService']: jest.Mock } => {
  let on = enabled;
  return {
    available:                         true,
    isEnabled:                         jest.fn(async () => on),
    setEnabled:                        jest.fn(async (v: boolean) => { on = v; }),
    startService:                      jest.fn(async () => undefined),
    stopService:                       jest.fn(),
    showNotification:                  jest.fn(),
    cancelNotification:                jest.fn(),
    isIgnoringBatteryOptimizations:    jest.fn(async () => true),
    requestIgnoreBatteryOptimizations: jest.fn(),
    consumeOpenChat:                   jest.fn(async () => null),
    onOpenChatRequest:                 () => () => undefined,
  };
};

const setup = (opts: { enabled?: boolean; foreground?: boolean; preview?: boolean; signedIn?: boolean } = {}) => {
  const fake = createFakeServices({
    hasSession:              jest.fn(async () => opts.signedIn ?? true),
    me:                      jest.fn(async () => ME),
    getChat:                 jest.fn(async () => directChat()),
    getNotificationSettings: jest.fn(async () => ({ preview: opts.preview ?? true })),
  });
  const native = fakeNative(opts.enabled);
  const ui = { foreground: opts.foreground ?? false };
  const connection = createConnectionKeeper(fake.socket as SocketClient);
  let time = 0;
  const controller = createBackgroundController({
    api:        fake.services.api,
    socket:     fake.services.socket,
    connection,
    native,
    ui:         { isForeground: () => ui.foreground },
    now:        () => time,
  });
  return { fake, native, ui, connection, controller, tick: (ms: number) => { time += ms; } };
};

describe('fon bildirishnomalari (Android, FCM\'siz)', () => {
  it('fonda: begona xabar — bildirishnoma (sarlavha yuboruvchi, tag = chatId); o\'zimizniki va tizim xabari — yo\'q', async () => {
    const { fake, native, controller } = setup();
    await controller.sync();
    fake.emit('message:new', { message: message(1) });
    fake.emit('message:new', { message: message(2, ME.id) });
    fake.emit('message:new', { message: { ...message(3), type: 'system' } });
    await flush();
    expect(native.showNotification).toHaveBeenCalledTimes(1);
    expect(native.showNotification).toHaveBeenCalledWith({
      tag: CHAT_ID, channel: 'messages', title: PEER.displayName, body: 'xabar 1', chatId: CHAT_ID,
    });
  });

  it('ilova ochiq bo\'lsa bildirishnoma yo\'q; guruhda "Ism: matn"; preview o\'chiq — "Yangi xabar"', async () => {
    const open = setup({ foreground: true });
    await open.controller.sync();
    open.fake.emit('message:new', { message: message(1) });
    await flush();
    expect(open.native.showNotification).not.toHaveBeenCalled();

    const group = setup();
    (group.fake.api.getChat as jest.Mock).mockResolvedValue(directChat({ type: 'group', title: 'Oila', members: [member(ME), member(PEER)] }));
    await group.controller.sync();
    group.fake.emit('message:new', { message: message(1) });
    await flush();
    expect(group.native.showNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Oila', body: 'Vali: xabar 1' }));

    const hidden = setup({ preview: false });
    await hidden.controller.sync();
    hidden.fake.emit('message:new', { message: message(1) });
    await flush();
    expect(hidden.native.showNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Suhbat', body: 'Yangi xabar' }));
  });

  it('chat ma\'lumoti keshlanadi; sozlama TTL bilan qayta o\'qiladi', async () => {
    const { fake, controller, tick } = setup();
    await controller.sync();
    fake.emit('message:new', { message: message(1) });
    await flush();
    fake.emit('message:new', { message: message(2) });
    await flush();
    expect(fake.api.getChat).toHaveBeenCalledTimes(1);
    expect(fake.api.getNotificationSettings).toHaveBeenCalledTimes(1);
    tick(SETTINGS_TTL_MS);
    fake.emit('message:new', { message: message(3) });
    await flush();
    expect(fake.api.getNotificationSettings).toHaveBeenCalledTimes(2);
    // Chat o'zgarsa — qayta o'qiladi
    fake.emit('chat:updated', { chatId: CHAT_ID, title: 'yangi', description: null, isPublic: false } as never);
    fake.emit('message:new', { message: message(4) });
    await flush();
    expect(fake.api.getChat).toHaveBeenCalledTimes(2);
  });

  it('kiruvchi qo\'ng\'iroq: "calls" kanalida; qo\'ng\'iroq tugasa bildirishnoma o\'chadi', async () => {
    const { fake, native, controller } = setup();
    await controller.sync();
    const callId = '00000000-0000-4000-8000-0000000000aa';
    fake.emit('call:invite', { callId, chatId: CHAT_ID, media: 'video', from: PEER, createdAt: new Date().toISOString() });
    await flush();
    expect(native.showNotification).toHaveBeenCalledWith({
      tag: callTag(callId), channel: 'calls', title: PEER.displayName, body: '🎥 Kiruvchi video qo\'ng\'iroq', chatId: CHAT_ID,
    });
    fake.emit('call:end', { callId, reason: 'missed', durationMs: null } as never);
    expect(native.cancelNotification).toHaveBeenCalledWith(callTag(callId));
  });

  it('sozlama yoqilgan: ulanish ushlanadi va service ishga tushadi; o\'chirilsa — qo\'yib yuboriladi', async () => {
    const { fake, native, connection, controller } = setup();
    await controller.sync();
    expect(connection.held).toBe(false);
    expect(native.startService).not.toHaveBeenCalled();

    await controller.setEnabled(true);
    expect(connection.held).toBe(true);
    expect(fake.socket.connect).toHaveBeenCalled();
    expect(native.startService).toHaveBeenCalled();

    await controller.setEnabled(false);
    expect(connection.held).toBe(false);
    expect(fake.socket.disconnect).toHaveBeenCalled();
    expect(native.stopService).toHaveBeenCalled();
  });

  it('UI ushlab turgan ulanish fon to\'xtaganda uzilmaydi; chiqishda hammasi to\'xtaydi', async () => {
    const { fake, native, connection, controller } = setup({ enabled: true });
    const releaseUi = connection.hold();
    await controller.sync();
    controller.stop();
    expect(connection.held).toBe(true);
    expect(fake.socket.disconnect).not.toHaveBeenCalled();
    expect(native.stopService).toHaveBeenCalled();
    fake.emit('message:new', { message: message(1) });
    await flush();
    expect(native.showNotification).not.toHaveBeenCalled();
    releaseUi();
    expect(fake.socket.disconnect).toHaveBeenCalledTimes(1);
  });

  it('sessiya yo\'q: tinglamaydi, service to\'xtatiladi (sozlama yoqilgan bo\'lsa ham)', async () => {
    const { fake, native, connection, controller } = setup({ enabled: true, signedIn: false });
    await controller.sync();
    expect(connection.held).toBe(false);
    expect(native.stopService).toHaveBeenCalled();
    fake.emit('message:new', { message: message(1) });
    await flush();
    expect(native.showNotification).not.toHaveBeenCalled();
  });
});
