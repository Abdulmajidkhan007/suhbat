#!/usr/bin/env node
// Qo'ng'iroq ovozlarini o'zimiz sintez qiladi (litsenziya masalasi yo'q — tashqi fayl ishlatilmaydi):
//   node scripts/gen-call-sounds.mjs
// - ring.wav     — kiruvchi qo'ng'iroq: ikki notali ohang, 3 s, takrorlanadi
// - ringback.wav — chiquvchi qo'ng'iroq kutish ovozi: 425 Hz, 1 s yangraydi + 2 s jim, takrorlanadi
// Natija repoga commit qilinadi (apps/web/public/sounds). 16 bit mono, 16 kHz.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'apps/web/public/sounds');
const RATE = 16_000;

/** Sinus nota: [boshlanish s, davomiylik s, chastota Hz, amplituda]. Yumshoq kirish/chiqish (klik bo'lmasin). */
const render = (seconds, notes) => {
  const samples = new Float32Array(Math.round(seconds * RATE));
  for (const [start, dur, freq, amp] of notes) {
    const from = Math.round(start * RATE);
    const n = Math.round(dur * RATE);
    const fade = Math.min(Math.round(0.02 * RATE), n >> 1);
    for (let i = 0; i < n && from + i < samples.length; i++) {
      const env = Math.min(1, i / fade, (n - 1 - i) / fade);
      samples[from + i] += amp * env * Math.sin((2 * Math.PI * freq * i) / RATE);
    }
  }
  return samples;
};

const wav = (samples) => {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
};

// E5–G5–B5 ... qisqa ohang, so'ng pauza
const ring = render(3, [
  [0.0, 0.25, 659.25, 0.35], [0.0, 0.25, 1318.5, 0.08],
  [0.3, 0.25, 783.99, 0.35], [0.3, 0.25, 1568, 0.08],
  [0.6, 0.45, 987.77, 0.35], [0.6, 0.45, 1975.5, 0.08],
  [1.2, 0.25, 659.25, 0.35], [1.2, 0.25, 1318.5, 0.08],
  [1.5, 0.25, 783.99, 0.35], [1.5, 0.25, 1568, 0.08],
  [1.8, 0.45, 987.77, 0.35], [1.8, 0.45, 1975.5, 0.08],
]);
const ringback = render(3, [[0, 1, 425, 0.3]]);

await mkdir(out, { recursive: true });
await writeFile(join(out, 'ring.wav'), wav(ring));
await writeFile(join(out, 'ringback.wav'), wav(ringback));
console.log(`yozildi: ${out}`);
