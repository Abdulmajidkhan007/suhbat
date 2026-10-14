#!/usr/bin/env node
// Ilova ikonkalarini `assets/brand/*.svg` dan generatsiya qiladi (sharp). Natija repoga commit qilinadi:
//   npm run icons
// - Android: mipmap-*/ic_launcher(_round).png, adaptive qatlamlar, mipmap-anydpi-v26/*.xml
// - iOS: AppIcon.appiconset (alfa kanalsiz) + Contents.json
// - Desktop (electron-builder): apps/desktop/resources/icon.png (1024), icon.icns, icon.ico
// - Veb: favicon.ico, icon.svg, logo192/512.png, apple-touch-icon.png, maskable-512.png
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brand = (name) => join(root, 'assets/brand', name);
const ICON = brand('icon.svg');
const BACKGROUND = brand('icon-background.svg');
const FOREGROUND = brand('icon-foreground.svg');

/** Adaptive foreground'dagi belgi (66/108 xavfsiz zona) iOS/maskable'da biroz kattaroq. */
const GLYPH_SCALE_FULL_BLEED = 1.2;

const svgToPng = (file, size) =>
  sharp(file, { density: Math.max(72, Math.ceil((size / 108) * 72 * 2)) }).resize(size, size).png().toBuffer();

/** Belgini markazdan `scale` marta kattalashtirib, `size` o'lchamga qirqadi. */
const glyph = async (size, scale) => {
  const big = Math.round(size * scale);
  const offset = Math.floor((big - size) / 2);
  const png = await svgToPng(FOREGROUND, big);
  return scale === 1 ? png : sharp(png).extract({ left: offset, top: offset, width: size, height: size }).png().toBuffer();
};

/** Fon + belgi, to'liq kvadrat (iOS, maskable, round). */
const fullBleed = async (size, scale = GLYPH_SCALE_FULL_BLEED) =>
  sharp(await svgToPng(BACKGROUND, size))
    .composite([{ input: await glyph(size, scale) }])
    .png()
    .toBuffer();

const circleMask = (size) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`);

/** Shaffof chekka bilan (`pad` — har tomondan ulush). */
const padded = async (file, size, pad) => {
  const inner = Math.round(size * (1 - pad * 2));
  const edge = Math.floor((size - inner) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await svgToPng(file, inner), left: edge, top: edge }])
    .png()
    .toBuffer();
};

const write = async (file, data) => {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, data);
  console.log(`  ${file.slice(root.length + 1)}`);
};

// --- ICO / ICNS: ichida PNG saqlanadigan formatlar, qo'shimcha kutubxonasiz yoziladi ---

const ico = (images) => {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(png.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.png)]);
};

const icns = (entries) => {
  const chunks = entries.map(({ type, png }) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii');
    head.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([head, png]);
  });
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(8 + chunks.reduce((n, c) => n + c.length, 0), 4);
  return Buffer.concat([head, ...chunks]);
};

// --- Android ---

const android = async () => {
  const res = join(root, 'apps/mobile/android/app/src/main/res');
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [name, k] of Object.entries(densities)) {
    const dir = join(res, `mipmap-${name}`);
    const legacy = 48 * k;
    const layer = 108 * k;
    // Eski (Android 7 va undan past) launcher'lar: tayyor shakl, 48dp ichida ~1dp chekka.
    await write(join(dir, 'ic_launcher.png'), await padded(ICON, legacy, 1 / 48));
    const round = await fullBleed(legacy);
    await write(
      join(dir, 'ic_launcher_round.png'),
      await sharp(round).composite([{ input: circleMask(legacy), blend: 'dest-in' }]).png().toBuffer(),
    );
    // Adaptive icon (Android 8+): 108dp qatlamlar, launcher o'zi shakl beradi.
    await write(join(dir, 'ic_launcher_foreground.png'), await glyph(layer, 1));
    await write(join(dir, 'ic_launcher_background.png'), await svgToPng(BACKGROUND, layer));
  }
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<!-- scripts/gen-icons.mjs yaratgan — qo'lda tahrirlamang. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
  await write(join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
  await write(join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);
};

// --- iOS ---

const ios = async () => {
  const dir = join(root, 'apps/mobile/ios/Suhbat/Images.xcassets/AppIcon.appiconset');
  const specs = [
    { idiom: 'iphone', size: 20, scale: 2 },
    { idiom: 'iphone', size: 20, scale: 3 },
    { idiom: 'iphone', size: 29, scale: 2 },
    { idiom: 'iphone', size: 29, scale: 3 },
    { idiom: 'iphone', size: 40, scale: 2 },
    { idiom: 'iphone', size: 40, scale: 3 },
    { idiom: 'iphone', size: 60, scale: 2 },
    { idiom: 'iphone', size: 60, scale: 3 },
    { idiom: 'ios-marketing', size: 1024, scale: 1 },
  ];
  const images = [];
  for (const { idiom, size, scale } of specs) {
    const px = size * scale;
    const filename = `icon-${px}.png`;
    // App Store alfa kanalli ikonkani rad etadi; iOS burchaklarni o'zi yumaloqlaydi.
    if (!images.some((i) => i.filename === filename)) {
      await write(join(dir, filename), await sharp(await fullBleed(px)).flatten({ background: '#3B82F6' }).removeAlpha().png().toBuffer());
    }
    images.push({ filename, idiom, scale: `${scale}x`, size: `${size}x${size}` });
  }
  await write(join(dir, 'Contents.json'), `${JSON.stringify({ images, info: { author: 'xcode', version: 1 } }, null, 2)}\n`);
};

// --- Desktop (electron-builder) ---

const desktop = async () => {
  const dir = join(root, 'apps/desktop/resources');
  await write(join(dir, 'icon.png'), await svgToPng(ICON, 1024));
  // macOS: shakl 1024 kanvasning ~80% ini egallaydi (Big Sur va keyingi ikonkalar kabi).
  const mac = async (size) => padded(ICON, size, 0.1);
  await write(
    join(dir, 'icon.icns'),
    icns([
      { type: 'icp4', png: await mac(16) },
      { type: 'icp5', png: await mac(32) },
      { type: 'icp6', png: await mac(64) },
      { type: 'ic07', png: await mac(128) },
      { type: 'ic08', png: await mac(256) },
      { type: 'ic09', png: await mac(512) },
      { type: 'ic10', png: await mac(1024) },
      { type: 'ic11', png: await mac(32) },
      { type: 'ic12', png: await mac(64) },
      { type: 'ic13', png: await mac(256) },
      { type: 'ic14', png: await mac(512) },
    ]),
  );
  const winSizes = [16, 24, 32, 48, 64, 128, 256];
  await write(join(dir, 'icon.ico'), ico(await Promise.all(winSizes.map(async (size) => ({ size, png: await svgToPng(ICON, size) })))));
};

// --- Veb ---

const web = async () => {
  const dir = join(root, 'apps/web/public');
  await copyFile(ICON, join(dir, 'icon.svg'));
  console.log('  apps/web/public/icon.svg');
  await write(join(dir, 'favicon.ico'), ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await svgToPng(ICON, size) })))));
  await write(join(dir, 'logo192.png'), await svgToPng(ICON, 192));
  await write(join(dir, 'logo512.png'), await svgToPng(ICON, 512));
  await write(join(dir, 'apple-touch-icon.png'), await sharp(await fullBleed(180)).removeAlpha().png().toBuffer());
  await write(join(dir, 'maskable-512.png'), await fullBleed(512, 1));
};

for (const [name, step] of Object.entries({ android, ios, desktop, web })) {
  console.log(`${name}:`);
  await step();
}
