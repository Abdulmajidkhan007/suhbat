# suhbat — reja

> Oxirgi yangilanish: 2026-10-11

## Hozirgi holat (koddan)
- Faqat veb: Create React App + MUI + Redux Toolkit + Firebase (Auth,
  Firestore, Realtime Database — "online" holati uchun).
- Ishlaydi: ro'yxatdan o'tish/kirish (email, Google, telefon), 1:1 chat,
  guruh va kanal dialoglari, real-time xabarlar.
- **Ma'lum xatolar** (2026-10-11 emulyatorda sinalganda topildi):
  - Birinchi xabardan keyin sahifa yiqiladi ("Invalid time value"):
    `formatChatTime` raqam kutadi, Firestore `Timestamp` qaytaradi.
  - `package-lock.json` `package.json` bilan mos emas — `npm ci` o'tmaydi.
- CRA eskirgan (rasmiy qo'llab-quvvatlanmaydi).

## Maqsad
Telegram'dek mustaqil messenjer: 1:1 va guruh chatlar, kanallar, media,
ovozli xabar, qidiruv, bildirishnomalar; keyin qo'ng'iroqlar. Platformalar:
veb, macOS, Windows, Android, iOS — bitta kod bazasi va bitta backend.

## Tuzilish
```
apps/
  api/       NestJS 11 — REST + WebSocket gateway, Prisma 7 + PostgreSQL
  web/       React 19 + Vite + TypeScript (hozirgi UI shu yerga ko'chadi)
  desktop/   Electron — web build'ni o'raydi (macOS, Windows)
  mobile/    bare React Native CLI (Android, iOS)
packages/
  core/      zod sxemalar va tiplar (User, Chat, Message ...) — hamma joyda bitta
  client/    API + WebSocket mijozi (web, desktop, mobile umumiy)
  ui-tokens/ ranglar, o'lchamlar (web va mobil uchun umumiy dizayn tokenlari)
```

## Backend qarorlari va nega
- **WebSocket (Socket.IO, NestJS gateway)** — xabar, "yozmoqda", "online"
  real vaqtda; REST — tarix, profil, fayl yuklash.
- **PostgreSQL + Prisma** — xabarlar tarixi uchun indekslar (chat_id,
  created_at) va keyset pagination; Firestore'dagi har o'qishga to'lov yo'q.
- **Redis** (keyin) — bir nechta API nusxasi orasida pub/sub va presence.
- **Fayllar** — S3-mos saqlash (MinIO), API faqat imzolangan URL beradi.
- **Auth** — JWT (access + refresh), parollar argon2; keyin telefon/SMS.
- Joylash: Docker Compose + Caddy (VPS). Qaysi server — egasi bilan hal qilinadi.

## Fazalar
**0. Monorepo poydevori**
- Turborepo, `packages/core`, `apps/api` (NestJS: health, auth), Docker
  Compose (Postgres), CI (lint, typecheck, test).
- Hozirgi CRA ilova `apps/web` ga ko'chadi va Vite'ga o'tadi; yuqoridagi
  ikki xato tuzatiladi.

**1. Asosiy chat (veb + API)**
- Ro'yxatdan o'tish/kirish, kontaktlar/qidiruv, 1:1 chat, xabar holati
  (yuborildi/o'qildi), "yozmoqda", "online". Firebase olib tashlanadi.

**2. Guruh, kanal, media**
- Guruh/kanal, rasm/fayl/ovozli xabar, xabarni tahrirlash/o'chirish.

**3. Desktop va mobil**
- Electron build (GitHub Release'ga), RN CLI ilova (CI'da APK, crash ekrani).

**4. Bildirishnomalar va qo'ng'iroqlar**
- Push (FCM/APNs), keyin WebRTC qo'ng'iroqlar.

## Keyingi sessiya uchun
Repo: `suhbat`. "CLAUDE.md va docs/REJA.md ni o'qi, 0-fazani boshla:
Turborepo monorepo, packages/core, apps/api (NestJS + Prisma + Postgres,
Docker Compose), hozirgi veb ilovani apps/web ga ko'chirib Vite'ga o'tkaz,
ikki ma'lum xatoni tuzat."
