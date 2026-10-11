import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api.js';
import { memoryTokenStorage } from './tokens.js';

const user = {
  id: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', email: 'ali@test.uz', displayName: 'Ali',
  photoUrl: null, createdAt: '2026-10-11T10:00:00.000Z',
};
const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? '' : JSON.stringify(body), { status });

const setup = (handler: (url: string, init: RequestInit) => Response | Promise<Response>, tokens = { accessToken: 'a1', refreshToken: 'r1' }) => {
  const storage = memoryTokenStorage(tokens);
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => handler(String(url), init ?? {}));
  const onSessionExpired = vi.fn();
  const api = createApiClient({ baseUrl: 'http://api', storage, fetch: fetch as typeof globalThis.fetch, onSessionExpired });
  return { api, storage, fetch, onSessionExpired };
};
const auth = (init: RequestInit) => (init.headers as Record<string, string>).Authorization;

describe('createApiClient', () => {
  it('login tokenlarni saqlaydi va userni qaytaradi', async () => {
    const { api, storage, fetch } = setup(() => json(200, { accessToken: 'A', refreshToken: 'R', user }), null as never);
    await expect(api.login({ email: 'ali@test.uz', password: 'x' })).resolves.toEqual(user);
    expect(await storage.get()).toEqual({ accessToken: 'A', refreshToken: 'R' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('http://api/auth/login');
    expect(init?.method).toBe('POST');
  });

  it('Bearer token yuboradi va query yig\'adi', async () => {
    const { api, fetch } = setup(() => json(200, [user]));
    await api.searchUsers('ali va', 5);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('http://api/users/search?q=ali%20va&limit=5');
    expect(auth(init!)).toBe('Bearer a1');
  });

  it('401 → refresh → so\'rov yangi token bilan takrorlanadi', async () => {
    const { api, storage, fetch } = setup((url, init) => {
      if (url.endsWith('/auth/refresh')) return json(200, { accessToken: 'a2', refreshToken: 'r2' });
      return auth(init) === 'Bearer a2' ? json(200, user) : json(401, { message: 'Unauthorized' });
    });
    await expect(api.me()).resolves.toEqual(user);
    expect(await storage.get()).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetch.mock.calls[1][1]!.body as string)).toEqual({ refreshToken: 'r1' });
  });

  it('parallel 401 lar bitta refresh bilan yechiladi', async () => {
    let refreshes = 0;
    const { api } = setup(async (url, init) => {
      if (url.endsWith('/auth/refresh')) {
        refreshes++;
        await new Promise((r) => setTimeout(r, 10));
        return json(200, { accessToken: 'a2', refreshToken: 'r2' });
      }
      return auth(init) === 'Bearer a2' ? json(200, []) : json(401);
    });
    await Promise.all([api.listChats(), api.listChats(), api.listChats()]);
    expect(refreshes).toBe(1);
  });

  it('refresh ham 401 → tokenlar o\'chadi, onSessionExpired, xato', async () => {
    const { api, storage, onSessionExpired } = setup(() => json(401, { message: 'Unauthorized' }));
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    expect(await storage.get()).toBeNull();
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  it('boshqa tab tokenni yangilagan bo\'lsa — refresh qilinmaydi', async () => {
    const { api, storage, fetch } = setup(async (url, init) => {
      if (url.endsWith('/auth/refresh')) throw new Error('chaqirilmasligi kerak');
      if (auth(init) === 'Bearer a1') {
        await storage.set({ accessToken: 'boshqa', refreshToken: 'r9' }); // "boshqa tab"
        return json(401);
      }
      return json(200, user);
    });
    await expect(api.me()).resolves.toEqual(user);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('server xabari ApiError ichida; tarmoq xatosi — status 0', async () => {
    const { api } = setup(() => json(404, { message: 'Chat topilmadi', statusCode: 404 }));
    const err = await api.getChat('x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, message: 'Chat topilmadi' });

    const offline = setup(() => { throw new TypeError('fetch failed'); });
    await expect(offline.api.me()).rejects.toMatchObject({ status: 0 });
  });

  it('logout: tokenlar o\'chadi, server xatosi yutiladi', async () => {
    const { api, storage, fetch } = setup(() => json(500));
    await api.logout();
    expect(await storage.get()).toBeNull();
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({ refreshToken: 'r1' });
  });

  it('sessiyasiz authed so\'rov — 401, tarmoqqa chiqmaydi', async () => {
    const { api, fetch } = setup(() => json(200), null as never);
    await expect(api.listChats()).rejects.toMatchObject({ status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
