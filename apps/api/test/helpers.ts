import type { SocketClient } from '@suhbat/client';
import type { ServerToClientEvents } from '@suhbat/core';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Bitta voqeani kutadi (shart bajarilguncha), vaqt o'tsa — xato. */
export const next = <E extends keyof ServerToClientEvents>(
  client: SocketClient,
  event: E,
  match: (p: Parameters<ServerToClientEvents[E]>[0]) => boolean = () => true,
  ms = 3000,
) =>
  new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve, reject) => {
    const timer = setTimeout(() => { off(); reject(new Error(`${event} kelmadi`)); }, ms);
    const off = client.on(event, ((p: Parameters<ServerToClientEvents[E]>[0]) => {
      if (!match(p)) return;
      clearTimeout(timer);
      off();
      resolve(p);
    }) as ServerToClientEvents[E]);
  });

/** Voqea ma'lum vaqt ichida KELMASLIGINI tekshiradi (kelsa — rad). */
export const never = <E extends keyof ServerToClientEvents>(client: SocketClient, event: E, ms = 300) =>
  new Promise<void>((resolve, reject) => {
    const off = client.on(event, (() => { off(); reject(new Error(`${event} kelmasligi kerak edi`)); }) as ServerToClientEvents[E]);
    setTimeout(() => { off(); resolve(); }, ms);
  });

export const waitConnected = (c: SocketClient) =>
  new Promise<void>((resolve, reject) => {
    if (c.isConnected()) return resolve();
    const timer = setTimeout(() => reject(new Error('ulanmadi')), 3000);
    const off = c.onConnectionChange((up) => { if (up) { clearTimeout(timer); off(); resolve(); } });
  });

interface StoredObject {
  body: Buffer;
  type: string;
}

/**
 * Minimal S3-mos soxta server (path-style): bucket/obyekt PUT, HEAD, GET, DELETE.
 * **Imzoni tekshirmaydi.** Faqat `S3_ENDPOINT` berilmagan (MinIO yo'q) lokal
 * muhitda ishlatiladi; CI'da haqiqiy MinIO.
 */
export const startFakeS3 = async () => {
  const objects = new Map<string, StoredObject>();
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const isBucket = path.split('/').filter(Boolean).length <= 1;
      if (isBucket) {
        res.writeHead(200).end();
        return;
      }
      const obj = objects.get(path);
      if (req.method === 'PUT') {
        objects.set(path, { body: Buffer.concat(chunks), type: String(req.headers['content-type'] ?? '') });
        res.writeHead(200, { ETag: '"fake"' }).end();
      } else if (req.method === 'DELETE') {
        objects.delete(path);
        res.writeHead(204).end();
      } else if (!obj) {
        res.writeHead(404).end();
      } else {
        res.writeHead(200, { 'Content-Length': obj.body.length, 'Content-Type': obj.type });
        res.end(req.method === 'HEAD' ? undefined : obj.body);
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  const endpoint = `http://localhost:${(server.address() as AddressInfo).port}`;
  return {
    endpoint,
    objects,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
};

/** `S3_ENDPOINT` bo'lmasa soxta server ko'taradi; qaytgan funksiya uni to'xtatadi. */
export const ensureStorage = async (): Promise<{ fake: Awaited<ReturnType<typeof startFakeS3>> | null; close: () => Promise<void> }> => {
  if (process.env.S3_ENDPOINT) return { fake: null, close: async () => undefined };
  const fake = await startFakeS3();
  process.env.S3_ENDPOINT = fake.endpoint;
  return { fake, close: fake.close };
};
