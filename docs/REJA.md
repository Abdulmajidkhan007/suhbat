# suhbat — reja

> Oxirgi yangilanish: 2026-10-11 (0-faza)

## Hozirgi holat (koddan)
- **Monorepo** (npm workspaces + Turborepo): `apps/web`, `apps/api`, `packages/core`.
- `apps/web`: CRA'dan **Vite 7**'ga ko'chirildi (React 19 + MUI + Redux Toolkit).
  Hali **Firebase**'da (Auth, Firestore, RTDB) — 1-fazada o'z API'mizga o'tadi.
  Env: `VITE_FIREBASE_*` (avval `REACT_APP_*`).
- `apps/api`: NestJS 11 + Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL 17.
  Bor: `GET /health`, `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
  (JWT access token, argon2). **Yo'q:** refresh token, chat/xabar modellari,
  WebSocket — bular 1-fazada.
- `packages/core`: zod sxemalar (User, Chat, Message, auth input/javob) va
  `toMillis` (vaqtni ms ga keltirish). API body'ni shu sxemalar bilan tekshiradi.
- Docker Compose: faqat Postgres. CI (`.github/workflows/ci.yml`): `npm ci`,
  lint, typecheck, test, build va Postgres bilan API e2e.
- **Tuzatilgan xatolar** (0-faza):
  - "Invalid time value": Firestore hujjatlari endi `services/firestoreMappers.ts`
    da ms ga keltiriladi (`serverTimestamps: 'estimate'`), formatterlar noto'g'ri
    qiymatda yiqilmaydi. Unit testlar bor; Firebase emulyatorida qayta
    sinalmagan.
  - `package-lock.json` qayta yaratildi — `npm ci` o'tadi.
  - Qo'shimcha: Firebase kalitlarisiz oq ekran o'rniga "config topilmadi" ekrani.
- Ma'lum cheklovlar:
  - `vitest` 4.0.x da qoldi: 4.1.x npm 10 bilan o'rnatilmaydi (arborist
    `edgesOut` xatosi). `npm audit` 4.0 ni (dev-only) critical deydi — npm
    yangilanganda 4.1.11+ ga o'tkazish kerak.
  - `npm audit`dagi qolgan high'lar asosan `firebase` (1-fazada olib
    tashlanadi) va `prisma` CLI tranzitiv bog'liqliklarida.
  - Veb bundle ~1.3 MB (code-splitting yo'q).
  - Netlify konfiguratsiyasi (`apps/web/netlify.toml`, Base directory =
    `apps/web`) yangilandi, lekin deploy sinalmagan.

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
**0. Monorepo poydevori** — ✅ bajarildi (2026-10-11), cheklovlar yuqorida
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
Repo: `suhbat`. "CLAUDE.md va docs/REJA.md ni o'qi, 1-fazani boshla:
Prisma'da Chat/ChatMember/Message modellari, refresh token, Socket.IO gateway
(xabar, yozmoqda, online), `packages/client`; veb ilovani Firebase'dan
o'z API'mizga o'tkaz."
