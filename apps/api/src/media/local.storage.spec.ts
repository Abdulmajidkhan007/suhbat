import type { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageDriver, UploadRejected } from './local.storage';

const key = 'chats/00000000-0000-4000-8000-0000000000c1/00000000-0000-4000-8000-0000000000a1';

const config = (env: Record<string, string>) =>
  ({
    get:         (k: string) => env[k],
    getOrThrow:  (k: string) => {
      if (env[k] === undefined) throw new Error(k);
      return env[k];
    },
  }) as unknown as ConfigService;

const query = (url: string) => Object.fromEntries(new URL(url).searchParams);
const body = (n: number) => Readable.from([Buffer.alloc(n, 7)]);

describe('LocalStorageDriver', () => {
  let dir: string;
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'suhbat-media-'));
    driver = new LocalStorageDriver(config({ MEDIA_DIR: dir, JWT_SECRET: 's', PUBLIC_API_URL: 'https://api.suhbat.uz/' }));
    await driver.init();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await rm(dir, { recursive: true, force: true });
  });

  it('papka: MEDIA_DIR → Railway Volume → ./.data/media', () => {
    expect(LocalStorageDriver.dirFrom(config({ MEDIA_DIR: '/x', RAILWAY_VOLUME_MOUNT_PATH: '/data' }))).toBe('/x');
    expect(LocalStorageDriver.dirFrom(config({ RAILWAY_VOLUME_MOUNT_PATH: '/data' }))).toBe('/data/media');
    expect(LocalStorageDriver.dirFrom(config({}))).toBe(join(process.cwd(), '.data', 'media'));
  });

  it('imzolangan PUT → yozish → head → imzolangan GET', async () => {
    const put = await driver.presignPut(key, 'image/png', 10);
    expect(put.url.startsWith('https://api.suhbat.uz/media/blob?')).toBe(true);
    expect(put.headers).toEqual({ 'Content-Type': 'application/octet-stream' });
    const ticket = driver.verifyPut(query(put.url));
    expect(ticket).toMatchObject({ key, mime: 'image/png', size: 10 });

    expect(await driver.head(key)).toBeNull();
    await driver.write(ticket!, body(10));
    expect(await driver.head(key)).toEqual({ size: 10, mime: 'image/png' });

    const get = await driver.presignGet(key, { name: 'rasm.png', mime: 'image/png', inline: true });
    expect(driver.verifyGet(query(get))).toMatchObject({ key, mime: 'image/png', name: 'rasm.png', inline: true });

    await driver.delete(key);
    expect(await driver.head(key)).toBeNull();
  });

  it('imzo: o\'zgartirilgan parametr, boshqa kalit yoki muddati o\'tgan havola rad etiladi', async () => {
    const q = query((await driver.presignPut(key, 'image/png', 10)).url);
    expect(driver.verifyPut({ ...q, size: '11' })).toBeNull();
    expect(driver.verifyPut({ ...q, mime: 'text/html' })).toBeNull();
    expect(driver.verifyPut({ ...q, key: `${key}0` })).toBeNull();
    expect(driver.verifyPut({ ...q, sig: 'x' })).toBeNull();
    // PUT imzosi GET uchun yaramaydi
    expect(driver.verifyGet({ ...q, name: 'a', disp: 'inline' })).toBeNull();

    const other = new LocalStorageDriver(config({ MEDIA_DIR: dir, JWT_SECRET: 'boshqa' }));
    expect(other.verifyPut(q)).toBeNull();

    const g = query(await driver.presignGet(key, { name: 'a.pdf', mime: 'application/pdf', inline: false }));
    expect(driver.verifyGet({ ...g, disp: 'inline' })).toBeNull();
    expect(driver.verifyGet({ ...g, name: 'b.pdf' })).toBeNull();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    expect(driver.verifyPut(q)).toBeNull(); // 10 daqiqa
    expect(driver.verifyGet(g)).not.toBeNull(); // 1 soat
  });

  it('hajm: ortiq bayt — 413, kam — 400; fayl joyiga qo\'yilmaydi', async () => {
    const ticket = { key, mime: 'image/png', size: 10, exp: 0 };
    await expect(driver.write(ticket, body(11))).rejects.toMatchObject({ status: 413 });
    await expect(driver.write(ticket, body(9))).rejects.toMatchObject({ status: 400 });
    await expect(driver.write(ticket, body(9))).rejects.toBeInstanceOf(UploadRejected);
    expect(await driver.head(key)).toBeNull();
  });

  it('mavjud faylni qayta yozib bo\'lmaydi (409)', async () => {
    const ticket = { key, mime: 'image/png', size: 4, exp: 0 };
    await driver.write(ticket, body(4));
    await expect(driver.write(ticket, Readable.from([Buffer.from('evil')]))).rejects.toMatchObject({ status: 409 });
  });

  it('kalit papkadan tashqariga chiqa olmaydi', () => {
    for (const bad of ['../etc/passwd', '/etc/passwd', 'chats/../../x', '.tmp/x', 'a/b.meta.json', '']) {
      expect(() => driver.pathOf(bad)).toThrow();
    }
    expect(driver.pathOf(key)).toBe(join(dir, key));
  });
});
