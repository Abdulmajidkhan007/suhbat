import { afterEach, describe, expect, it, vi } from 'vitest';

const user = {
  id: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', email: 'ali@test.uz', displayName: 'Ali',
  username: 'ali_v', photoUrl: null, bio: null, createdAt: '2026-10-11T10:00:00.000Z',
};

describe('veb api: tokenlar localStorage\'da saqlanmaydi (S-4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('login’dan keyin localStorage/sessionStorage bo‘sh; so‘rov cookie rejimida', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ accessToken: 'acc', refreshToken: '', user }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { api } = await import('./api');

    await api.login({ login: 'ali@test.uz', password: '12345678' });

    expect(await api.getAccessToken()).toBe('acc');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['X-Suhbat-Cookie']).toBe('1');
  });
});
