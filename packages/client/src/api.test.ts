import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api.js';
import { memoryTokenStorage, webRefreshLock } from './tokens.js';

const user = {
  id: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', email: 'ali@test.uz', displayName: 'Ali',
  username: 'ali_v', photoUrl: null, bio: null, createdAt: '2026-10-11T10:00:00.000Z',
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

describe('createApiClient: admin', () => {
  const ID = '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f';
  const row = {
    id: ID, username: null, displayName: 'Ali', email: 'ali@test.uz', createdAt: '2026-10-11T10:00:00.000Z', lastSeenAt: null,
    hasRecoveryCodes: false, activeSessions: 1, blocked: false, mustChangePassword: false, isAdmin: false,
  };

  it('listUsers so\'rov parametrlari bilan; vaqtinchalik parol va kodlar javobdan olinadi; bulkDelete body', async () => {
    const { api, fetch } = setup((url, init) => {
      if (url.startsWith('http://api/admin/users?')) return json(200, { items: [row], total: 1, page: 2, pageSize: 5 });
      if (url.endsWith('/temp-password')) return json(200, { temporaryPassword: 'abcd-efgh-jkmn-pqrs' });
      if (url.endsWith('/recovery-codes')) return json(200, { codes: ['AAAA-BBBB-CCCC'] });
      if (url.endsWith('/bulk-delete')) return json(200, { deleted: [ID], notFound: [] });
      return init.method === 'DELETE' || init.method === 'POST' ? new Response(null, { status: 204 }) : json(404);
    });
    await expect(api.admin.listUsers({ q: 'ali', page: 2, pageSize: 5 })).resolves.toMatchObject({ total: 1, items: [{ id: ID }] });
    await expect(api.admin.tempPassword(ID)).resolves.toBe('abcd-efgh-jkmn-pqrs');
    await expect(api.admin.recoveryCodes(ID)).resolves.toEqual(['AAAA-BBBB-CCCC']);
    await expect(api.admin.bulkDelete([ID])).resolves.toEqual({ deleted: [ID], notFound: [] });
    await api.admin.block(ID);
    await api.admin.deleteUser(ID);

    const calls = fetch.mock.calls.map(([u, i]) => `${i?.method} ${String(u)}`);
    expect(calls).toEqual([
      'GET http://api/admin/users?q=ali&page=2&pageSize=5',
      `POST http://api/admin/users/${ID}/temp-password`,
      `POST http://api/admin/users/${ID}/recovery-codes`,
      'POST http://api/admin/users/bulk-delete',
      `POST http://api/admin/users/${ID}/block`,
      `DELETE http://api/admin/users/${ID}`,
    ]);
    expect(JSON.parse(fetch.mock.calls[3][1]!.body as string)).toEqual({ ids: [ID] });
    for (const [, init] of fetch.mock.calls) expect(auth(init!)).toBe('Bearer a1');
  });

  it('admin bo\'lmagan hisobda 404 — ApiError', async () => {
    const { api } = setup(() => json(404, { message: 'Not Found' }));
    await expect(api.admin.listUsers()).rejects.toMatchObject({ status: 404 });
  });
});

describe('createApiClient', () => {
  it('login tokenlarni saqlaydi va userni qaytaradi', async () => {
    const { api, storage, fetch } = setup(() => json(200, { accessToken: 'A', refreshToken: 'R', user }), null as never);
    await expect(api.login({ login: 'ali_v', password: 'x' })).resolves.toEqual(user);
    expect(await storage.get()).toEqual({ accessToken: 'A', refreshToken: 'R' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('http://api/auth/login');
    expect(init?.method).toBe('POST');
  });

  it('forgotPassword / resetPassword / checkUsername — tokensiz', async () => {
    const { api, fetch } = setup((url) => {
      if (url.endsWith('/auth/forgot-password')) return json(200, { message: 'ok' });
      if (url.endsWith('/auth/reset-password')) return new Response(null, { status: 204 });
      return json(200, { username: 'ali_v', available: false, reason: 'Bu username band' });
    }, null as never);
    await expect(api.forgotPassword('ali_v')).resolves.toEqual({ message: 'ok' });
    await expect(api.resetPassword('tok', 'yangi-parol')).resolves.toBeUndefined();
    await expect(api.checkUsername('@Ali V')).resolves.toMatchObject({ available: false });
    const [[u1, i1], [u2, i2], [u3, i3]] = fetch.mock.calls;
    expect(u1).toBe('http://api/auth/forgot-password');
    expect(JSON.parse(i1!.body as string)).toEqual({ emailOrUsername: 'ali_v' });
    expect(u2).toBe('http://api/auth/reset-password');
    expect(JSON.parse(i2!.body as string)).toEqual({ token: 'tok', newPassword: 'yangi-parol' });
    expect(u3).toBe('http://api/users/username-available?u=%40Ali%20V');
    for (const init of [i1, i2, i3]) expect(auth(init!)).toBeUndefined();
  });

  it('forgotPassword 503 — ApiError server matni bilan', async () => {
    const { api } = setup(() => json(503, { message: 'Email yuborish hozircha sozlanmagan' }), null as never);
    await expect(api.forgotPassword('a@b.uz')).rejects.toMatchObject({ status: 503, message: 'Email yuborish hozircha sozlanmagan' });
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

  describe('ikki tab (umumiy storage, alohida mijoz) — 5.1', () => {
    // Server qoidasi: bir refresh token faqat bir marta; ikkinchi marta kelsa — sessiya yopiladi.
    const twoTabs = (withLock: boolean) => {
      const storage = memoryTokenStorage({ accessToken: 'a1', refreshToken: 'r1' });
      const used = new Set<string>();
      let serverSessionKilled = false;
      let seq = 1;
      const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        if (String(url).endsWith('/auth/refresh')) {
          await new Promise((r) => setTimeout(r, 5));
          const { refreshToken } = JSON.parse(init!.body as string) as { refreshToken: string };
          if (used.has(refreshToken)) { serverSessionKilled = true; return json(401); }
          used.add(refreshToken);
          seq++;
          return json(200, { accessToken: `a${seq}`, refreshToken: `r${seq}` });
        }
        return auth(init!) === 'Bearer a1' ? json(401) : json(200, []);
      });
      // Web Locks o'rnini bosuvchi oddiy navbat (bitta "brauzer"dagi barcha tablar uchun umumiy).
      let tail: Promise<unknown> = Promise.resolve();
      const lock = <T,>(fn: () => Promise<T>): Promise<T> => {
        const run = tail.then(fn, fn);
        tail = run.catch(() => undefined);
        return run;
      };
      const mk = () => createApiClient({
        baseUrl: 'http://api', storage, fetch: fetch as typeof globalThis.fetch,
        ...(withLock ? { lock } : {}),
      });
      return { tabA: mk(), tabB: mk(), killed: () => serverSessionKilled, storage };
    };

    it('qulfsiz: ikkala tab bir vaqtda 401 olsa bir token ikki marta ishlatiladi (bug)', async () => {
      const { tabA, tabB, killed } = twoTabs(false);
      await Promise.allSettled([tabA.listChats(), tabB.listChats()]);
      expect(killed()).toBe(true);
    });

    it('qulf bilan: ikkinchi tab yangilangan tokenni ko\'radi, refresh bitta, sessiya tirik', async () => {
      const { tabA, tabB, killed, storage } = twoTabs(true);
      await expect(Promise.all([tabA.listChats(), tabB.listChats()])).resolves.toEqual([[], []]);
      expect(killed()).toBe(false);
      expect(await storage.get()).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
    });
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

  it('logout: deviceToken berilsa body\'ga qo\'shiladi', async () => {
    const { api, fetch } = setup(() => json(200));
    await api.logout({ deviceToken: 'fcm-1' });
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({ refreshToken: 'r1', deviceToken: 'fcm-1' });
  });

  it('unregisterDevice: token URL\'da kodlanadi', async () => {
    const { api, fetch } = setup(() => json(200));
    await api.unregisterDevice('a:b/c');
    expect(String(fetch.mock.calls[0][0])).toMatch(/\/devices\/a%3Ab%2Fc$/);
    expect(fetch.mock.calls[0][1]!.method).toBe('DELETE');
  });

  it('sessiyasiz authed so\'rov — 401, tarmoqqa chiqmaydi', async () => {
    const { api, fetch } = setup(() => json(200), null as never);
    await expect(api.listChats()).rejects.toMatchObject({ status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uploadAttachment: imzolangan URL olib, faylni PUT qiladi (Bearer yo\'q)', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const { api } = setup((url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/media/upload-url')) {
        return json(200, {
          attachmentId: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e50',
          uploadUrl:    'http://s3/put?sig=1',
          headers:      { 'Content-Type': 'image/png' },
          expiresAt:    '2026-10-11T10:10:00.000Z',
        });
      }
      return new Response(null, { status: 200 });
    });
    const body = new Blob(['x']);
    const res = await api.uploadAttachment(
      { chatId: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e51', kind: 'image', name: 'a.png', mime: 'image/png', size: 1 },
      body,
    );
    expect(res.attachmentId).toBe('6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e50');
    expect(calls[1].url).toBe('http://s3/put?sig=1');
    expect(calls[1].init).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'image/png' }, body });
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('uploadAttachment: saqlash rad etsa — ApiError', async () => {
    const { api } = setup((url) =>
      url.endsWith('/media/upload-url')
        ? json(200, {
            attachmentId: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e50', uploadUrl: 'http://s3/put',
            headers: {}, expiresAt: '2026-10-11T10:10:00.000Z',
          })
        : new Response('denied', { status: 403 }),
    );
    await expect(
      api.uploadAttachment({ chatId: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e51', kind: 'file', name: 'a', mime: 'text/plain', size: 1 }, new Blob(['x'])),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('guruh/kanal metodlari to\'g\'ri yo\'l va usulni ishlatadi', async () => {
    const { api, fetch } = setup(() => new Response(null, { status: 204 }));
    await api.leaveChat('c1');
    await api.removeMember('c1', 'u1');
    await api.deleteChat('c1');
    const calls = fetch.mock.calls.map(([u, i]) => `${i?.method} ${u}`);
    expect(calls).toEqual([
      'POST http://api/chats/c1/leave',
      'DELETE http://api/chats/c1/members/u1',
      'DELETE http://api/chats/c1',
    ]);
  });
});

describe('webRefreshLock', () => {
  it('Web Locks bo\'lmasa — funksiyani oddiy chaqiradi', async () => {
    await expect(webRefreshLock()(async () => 42)).resolves.toBe(42);
  });

  it('Web Locks bor — bir xil nom bilan ketma-ket bajaradi', async () => {
    const order: string[] = [];
    let tail: Promise<unknown> = Promise.resolve();
    const request = vi.fn((_n: string, fn: () => Promise<unknown>) => (tail = tail.then(fn)));
    vi.stubGlobal('navigator', { locks: { request } });
    try {
      const lock = webRefreshLock('x');
      await Promise.all([
        lock(async () => { await new Promise((r) => setTimeout(r, 5)); order.push('a'); }),
        lock(async () => { order.push('b'); }),
      ]);
      expect(order).toEqual(['a', 'b']);
      expect(request).toHaveBeenCalledWith('x', expect.any(Function));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
