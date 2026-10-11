import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSocketClient } from './socket.js';

const msg = {
  id: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', chatId: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e50',
  senderId: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e51', type: 'text', content: 'salom',
  attachment: null, createdAt: '2026-10-11T10:00:00.000Z', editedAt: null,
};

let cleanup: (() => Promise<void>) | null = null;
afterEach(async () => {
  await cleanup?.();
  cleanup = null;
});

/** Haqiqiy socket.io server: faqat `valid` tokenni qabul qiladi. */
const startServer = async () => {
  const http = createServer();
  const io = new Server(http);
  io.use((socket, next) => (socket.handshake.auth.token === 'valid' ? next() : next(new Error('unauthorized'))));
  io.on('connection', (socket) => {
    socket.on('message:edit', (p, ack) => ack({ ok: true, data: { ...msg, content: p.content, editedAt: msg.createdAt } }));
    socket.on('message:delete', (_p, ack) => ack({ ok: true, data: { deletedAt: msg.createdAt } }));
    socket.on('message:send', (p, ack) => {
      if (!p.content) return ack({ ok: false, error: 'Validation failed' });
      ack({ ok: true, data: { ...msg, content: p.content } });
    });
  });
  await new Promise<void>((r) => http.listen(0, r));
  const url = `http://localhost:${(http.address() as AddressInfo).port}`;
  cleanup = async () => {
    io.close();
    await new Promise((r) => http.close(r));
  };
  return { io, url };
};

const waitFor = (fn: () => boolean, ms = 3000) =>
  new Promise<void>((resolve, reject) => {
    const started = Date.now();
    const tick = () => (fn() ? resolve() : Date.now() - started > ms ? reject(new Error('timeout')) : setTimeout(tick, 10));
    tick();
  });

describe('createSocketClient', () => {
  it('unauthorized → tokenni yangilab qayta ulanadi', async () => {
    const { url } = await startServer();
    let token = 'expired';
    const refresh = vi.fn(async () => { token = 'valid'; return token; });
    const client = createSocketClient({ url, getAccessToken: async () => token, refreshAccessToken: refresh });
    client.connect();
    await waitFor(() => client.isConnected());
    expect(refresh).toHaveBeenCalledOnce();
    client.disconnect();
  });

  it('server o\'zi uzsa (token muddati tugadi) — yangi token bilan qayta ulanadi', async () => {
    const { io, url } = await startServer();
    const token = 'valid';
    const refresh = vi.fn(async () => token);
    const client = createSocketClient({ url, getAccessToken: async () => token, refreshAccessToken: refresh });
    let connects = 0;
    client.onConnectionChange((up) => { if (up) connects++; });
    client.connect();
    await waitFor(() => client.isConnected());
    io.disconnectSockets(true);
    await waitFor(() => connects === 2);
    expect(refresh).toHaveBeenCalledOnce();
    client.disconnect();
  });

  it('server uzgach refresh ham yordam bermasa — onUnauthorized, qayta ulanmaydi', async () => {
    const { io, url } = await startServer();
    const onUnauthorized = vi.fn();
    const client = createSocketClient({
      url, getAccessToken: async () => 'valid', refreshAccessToken: async () => null, onUnauthorized,
    });
    client.connect();
    await waitFor(() => client.isConnected());
    io.disconnectSockets(true);
    await waitFor(() => onUnauthorized.mock.calls.length > 0);
    expect(client.isConnected()).toBe(false);
  });

  it('o\'zi disconnect() qilsa refresh chaqirilmaydi', async () => {
    const { url } = await startServer();
    const refresh = vi.fn(async () => 'valid');
    const client = createSocketClient({ url, getAccessToken: async () => 'valid', refreshAccessToken: refresh });
    client.connect();
    await waitFor(() => client.isConnected());
    client.disconnect();
    await new Promise((r) => setTimeout(r, 50));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('editMessage / deleteMessage ack natijasini qaytaradi', async () => {
    const { url } = await startServer();
    const client = createSocketClient({ url, getAccessToken: async () => 'valid', refreshAccessToken: async () => null });
    client.connect();
    await waitFor(() => client.isConnected());
    await expect(client.editMessage(msg.chatId, msg.id, 'yangi')).resolves.toMatchObject({ content: 'yangi' });
    await expect(client.deleteMessage(msg.chatId, msg.id)).resolves.toEqual({ deletedAt: msg.createdAt });
    client.disconnect();
  });

  it('refresh yordam bermasa — onUnauthorized', async () => {
    const { url } = await startServer();
    const onUnauthorized = vi.fn();
    const client = createSocketClient({
      url, getAccessToken: async () => 'bad', refreshAccessToken: async () => null, onUnauthorized,
    });
    client.connect();
    await waitFor(() => onUnauthorized.mock.calls.length > 0);
    expect(client.isConnected()).toBe(false);
  });

  it('sendMessage ack natijasini qaytaradi, ok:false → xato', async () => {
    const { url } = await startServer();
    const client = createSocketClient({ url, getAccessToken: async () => 'valid', refreshAccessToken: async () => null });
    client.connect();
    await waitFor(() => client.isConnected());
    await expect(client.sendMessage({ chatId: msg.chatId, content: 'hi' })).resolves.toMatchObject({ content: 'hi' });
    await expect(client.sendMessage({ chatId: msg.chatId, content: '' })).rejects.toThrow('Validation failed');
    client.disconnect();
  });

  it('on() server voqeasini qabul qiladi va unsubscribe ishlaydi', async () => {
    const { io, url } = await startServer();
    const client = createSocketClient({ url, getAccessToken: async () => 'valid', refreshAccessToken: async () => null });
    const got: string[] = [];
    const off = client.on('message:new', (e) => got.push(e.message.content));
    client.connect();
    await waitFor(() => client.isConnected());
    io.emit('message:new', { message: msg });
    await waitFor(() => got.length === 1);
    off();
    io.emit('message:new', { message: msg });
    await new Promise((r) => setTimeout(r, 50));
    expect(got).toEqual(['salom']);
    client.disconnect();
  });
});
