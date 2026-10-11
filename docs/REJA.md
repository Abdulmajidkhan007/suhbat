# suhbat — reja

> Oxirgi yangilanish: 2026-10-11 (1-faza)

## Hozirgi holat (koddan)
- **Monorepo** (npm workspaces + Turborepo): `apps/web`, `apps/api`,
  `packages/core`, `packages/client`.
- `apps/api` (NestJS 11 + Prisma 7 + PostgreSQL 17):
  - Modellar: `User` (+`last_seen_at`), `RefreshToken`, `Chat`
    (`direct|group|channel`, `direct_key` unique — juftlik uchun bitta 1:1),
    `ChatMember` (`role`, `last_read_at`), `Message`
    (indeks `(chat_id, created_at DESC, id DESC)`).
  - REST: `/auth/register|login|refresh|logout|me`, `/users/search`,
    `/chats` (ro'yxat + `unreadCount`), `POST /chats/direct` (idempotent),
    `/chats/:id`, `/chats/:id/messages` (keyset pagination, `before` kursor;
    `POST` — REST zaxira). Ro'yxat jadvali — `README.md`.
  - Socket.IO gateway (JWT `handshake.auth.token`): `message:send` (ack),
    `typing`, `message:read`, `presence:state` / `presence:update`.
    Voqealar `user:<id>` xonalariga yuboriladi.
- `packages/core`: zod sxemalar (auth, chat, xabar, sahifa), WebSocket event
  tiplari (`ws.ts`), `messageStatus`, `toMillis`.
- `packages/client`: `createApiClient` (401 da avtomatik refresh,
  single-flight, `TokenStorage` — veb/mobil uchun almashtiriladi) va
  `createSocketClient` (tokenni har ulanishda oladi, `unauthorized` da bir
  marta refresh qilib qayta ulanadi). Web, desktop, mobile uchun umumiy.
- `apps/web`: **Firebase olib tashlandi** (paket, `firebase.json`, `*.rules`,
  `VITE_FIREBASE_*`). Env: `VITE_API_URL`. Ishlaydi: ro'yxatdan o'tish/kirish,
  sessiyani tiklash (refresh), qidiruv, 1:1 chat, real vaqt xabar
  (optimistik, ack), "yozmoqda", onlayn/oflayn, yuborildi/o'qildi
  (bitta/ikki belgi), o'qilmaganlar soni, eskiroq xabarlarni yuklash,
  qayta ulanganda qayta yuklash.
  Guruh/kanal menyuda "tez orada" (o'chirilgan); Google/telefon bilan kirish,
  fayl/ovoz, profilni tahrirlash — "tez orada". Guruh/kanal dialoglari
  (`CreateGroupDialog`, `CreateChannelDialog`, `AddMemberDialog`) Firebase'ga
  bog'liq edi va o'chirildi — git tarixida bor (`3fbb52c`), 2-fazada API
  bilan qayta yoziladi.
- Docker Compose: faqat Postgres. CI: `npm ci`, lint, typecheck, test, build,
  Postgres bilan API e2e.

### Auth qarori: refresh token — body'da (cookie emas)
- `login/register` → `{ accessToken, refreshToken, user }`; `/auth/refresh`
  `{ refreshToken }` → yangi juftlik; `/auth/logout` `{ refreshToken }`.
- **Nega body:** bitta kontrakt web, Electron va React Native uchun (RN'da
  httpOnly cookie noqulay); veb va API turli domenda bo'lsa cross-site cookie
  (`SameSite=None`, CORS credentials, CSRF) murakkabligi yo'q.
- Himoya: access token 15 daqiqa; refresh token opaque (48 bayt), bazada
  faqat sha256 hash, 30 kun (`REFRESH_TOKEN_TTL_DAYS`); **rotatsiya** — har
  refresh'da eski bekor; bekor qilingan token qayta kelsa butun oila
  (sessiya) bekor qilinadi.
- **Kamchilik (ochiq):** vebda tokenlar `localStorage`da — XSS bo'lsa
  o'g'irlanishi mumkin. Veb va API bir domenga (masalan `suhbat.uz` /
  `api.suhbat.uz`) chiqqanda vebni httpOnly cookie'ga o'tkazish ko'rib
  chiqiladi; mobil body'da qoladi (Keychain/Keystore).

### Xabar holati
- `sent` — serverda saqlandi (ack keldi); `read` — boshqa a'zoning
  `last_read_at` >= xabar vaqti. "Yetkazildi" (delivered) **yo'q** — kerak
  bo'lsa alohida maydon bilan qo'shiladi.

### Ma'lum cheklovlar
- Presence (kim onlayn) va Socket.IO xonalari **bitta API nusxasi
  xotirasida**. Bir nechta nusxa uchun Redis adapter + Redis presence kerak.
- Ikki tab bir vaqtning o'zida refresh qilsa (aynan bir millisekundda), server
  buni token qayta ishlatilishi deb ko'rib sessiyani yopishi mumkin. Mijoz
  boshqa tab yangilagan tokenni ko'rsa qayta refresh qilmaydi, lekin to'liq
  tablar-aro qulf (Web Locks) yo'q.
- Rate limit yo'q (login, xabar yuborish, typing).
- "Yozmoqda" qabul qiluvchida 6 soniyada o'chadi; yuboruvchi har 3 soniyada
  yangilaydi.
- Profil tahrirlash API'si yo'q.
- `vitest` 4.0.x da qoldi: 4.1.x npm 10 bilan o'rnatilmaydi (arborist
  `edgesOut` xatosi). `npm audit` 4.0 ni (dev-only) critical deydi.
- Veb bundle ~1 MB (code-splitting yo'q) — Vite ogohlantiradi.
- Netlify konfiguratsiyasi yangilandi (`VITE_API_URL` kerak), deploy
  sinalmagan; API hali hech qayerga joylanmagan.

### 1-fazada nima tekshirildi
- `npx turbo run lint typecheck test build` — yashil (core 16, client 13,
  api 20, web 18 unit test).
- `npm run test:e2e -w @suhbat/api` — haqiqiy Postgres + Socket.IO:
  qidiruv, 1:1 (idempotent, begona 404), onlayn, yozmoqda, xabar (ack +
  real vaqt), o'qildi, unread, tarix sahifalari, yangi chatda presence,
  offline + lastSeenAt, refresh rotatsiyasi va qayta ishlatish, logout.
- Brauzerda qo'lda (Playwright, lokal API + Vite, ikki foydalanuvchi):
  ro'yxatdan o'tish, qidiruv, chat ochish, real vaqt xabar, "yozmoqda",
  o'qildi belgisi, onlayn/oflayn, sahifani yangilaganda sessiya tiklanishi.
- **Tekshirilmagan:** mobil brauzer/kichik ekran, Netlify deploy, bir nechta
  API nusxasi, uzoq muddatli ulanish (token muddati tugashi + qayta ulanish
  faqat unit testda), `npx turbo run dev` buyrug'i (API va veb alohida
  ishga tushirib sinaldi).

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

**1. Asosiy chat (veb + API)** — ✅ bajarildi (2026-10-11), cheklovlar yuqorida
- Ro'yxatdan o'tish/kirish (+refresh, logout), qidiruv, 1:1 chat, xabar holati
  (yuborildi/o'qildi), "yozmoqda", "online". Firebase olib tashlandi.

**2. Guruh, kanal, media**
- Guruh/kanal, rasm/fayl/ovozli xabar, xabarni tahrirlash/o'chirish.

**3. Desktop va mobil**
- Electron build (GitHub Release'ga), RN CLI ilova (CI'da APK, crash ekrani).

**4. Bildirishnomalar va qo'ng'iroqlar**
- Push (FCM/APNs), keyin WebRTC qo'ng'iroqlar.

## Keyingi sessiya uchun
Repo: `suhbat`. "CLAUDE.md va docs/REJA.md ni o'qi, 2-fazani boshla
(guruh, kanal, media):
1. API: guruh yaratish (`POST /chats/group` — nom, a'zolar), a'zo qo'shish/
   chiqarish, rollar (`owner/admin/member`) tekshiruvi; kanal (faqat
   owner/admin yozadi, obuna bo'lish/chiqish, ochiq kanal qidiruvi).
   Gateway: a'zolik o'zgarishi voqealari (`chat:updated`, `chat:member`).
2. Xabarni tahrirlash/o'chirish (`editedAt`, soft-delete) + WS voqealari.
3. Media: S3-mos saqlash (lokal — MinIO, docker compose), API imzolangan
   upload URL beradi; rasm/fayl/ovozli xabar (`type`, `attachment` maydoni).
4. `packages/core`/`packages/client` — yangi sxemalar va metodlar.
5. Veb: guruh/kanal dialoglarini API bilan qayta yozish (eski UI git
   tarixida, `3fbb52c`), fayl/ovoz yuborish, tahrirlash/o'chirish.
6. Testlar (unit + e2e), `docs/REJA.md` yangilash."
Ixtiyoriy (1-fazadan qolgan): rate limit (`@nestjs/throttler`), profilni
tahrirlash (`PATCH /users/me`), veb bundle code-splitting.
