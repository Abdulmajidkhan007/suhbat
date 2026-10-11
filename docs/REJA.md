# suhbat — reja

> Oxirgi yangilanish: 2026-10-11 (2-faza)

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
  Google/telefon bilan kirish, profilni tahrirlash — "tez orada".
- **2-faza (guruh, kanal, media)** — API:
  - `Chat` + `description`, `isPublic`; `Message` + `deletedAt` (soft-delete);
    `Attachment` (S3 kaliti, MIME, hajm, davomiylik). Migratsiya
    `*_groups_channels_media`.
  - Guruh (`POST /chats/group`, ≤ 200 a'zo) va kanal (`POST /chats/channel`);
    rollar `owner/admin/member`; a'zo qo'shish/chiqarish, rol berish (faqat owner),
    chiqish, obuna (`/join`, faqat ochiq kanal), ochiq kanal qidiruvi
    (`GET /chats/public`), sozlamalar (`PATCH /chats/:id`), o'chirish (faqat owner).
    Kanalda faqat owner/admin yozadi (REST, WS va yuklash URL'i ham tekshiradi).
    Huquq funksiyalari `@suhbat/core` da (`canWrite/canManage/canRemove/...`).
  - Xabar tahrirlash (faqat o'z matni, `editedAt`) va o'chirish (muallif yoki
    guruh/kanal owner/admini; matn tozalanadi, fayl saqlashdan o'chadi).
    WS: `message:edit|delete` (ack), `message:updated|deleted`,
    `chat:updated|member|deleted`.
  - Media: MinIO (S3-mos). `POST /media/upload-url` → imzolangan `PUT` URL (hajm va
    Content-Type imzoga kiradi), mijoz to'g'ridan-to'g'ri yuklaydi, xabarda
    `attachmentId`; server `HEAD` bilan hajm/turni qayta tekshiradi. Yuklab olish —
    1 soatlik imzolangan URL (rasm/ovoz `inline`, fayl `attachment`). Cheklov:
    rasm ≤ 10 MB, ovoz ≤ 10 MB / 5 daqiqa, fayl ≤ 25 MB; MIME ruxsat ro'yxati
    (`ATTACHMENT_RULES`, SVG/HTML/bajariladigan fayl yo'q).
  - 1-faza review tuzatishlari: `/users/search` emailni faqat to'liq mos kelganda
    topadi; socket access token `exp` vaqtida uziladi, `@suhbat/client` yangilab
    qayta ulanadi.
- `apps/web`: guruh/kanal yaratish, ochiq kanallarni qidirish/obuna, chat
  ma'lumotlari (nom/tavsif, a'zolar, admin tayinlash, chiqarish, qo'shish, chiqish/
  o'chirish), fayl/rasm yuborish, ovozli xabar (MediaRecorder), xabarni tahrirlash
  (inline) va o'chirish, kanalda oddiy a'zo uchun yopiq composer.
  Mobilda chat tanlanmaganda menyu tugmasi qo'shildi.
- Docker Compose: Postgres + MinIO. CI: `npm ci`, lint, typecheck, test, build,
  MinIO (compose, `docker/minio`) va Postgres bilan API e2e.

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
- **Foydalanuvchi emaili boshqalarga ko'rinadi:** `User` DTO'da `email` bor, shu
  sababli ism bo'yicha qidiruv va chat a'zolari ro'yxati emailni qaytaradi.
  Qidiruv endi emailni terib topishga yo'l qo'ymaydi, lekin ism bo'yicha topilgan
  odamning emaili javobda bor. Tuzatish: `PublicUser` (emailsiz) sxemasi — 3-faza
  boshida tavsiya.
- **Media:** tugatilmagan yuklashlar (URL olindi, xabar yuborilmadi) `attachments`
  da `messageId = null` bilan va saqlashda qoladi — tozalash vazifasi yo'q.
  Media uchun rate limit / foydalanuvchi kvotasi yo'q. Kanal/guruh o'chirilganda
  fayllar o'chadi (best-effort). Rasmdan thumbnail/o'lcham yo'q, virus tekshiruvi yo'q.
- Kanalda minglab obunachi: `members` faqat owner/admin + o'zi qaytaradi, lekin
  xabar yuborishda a'zolar ro'yxati to'liq o'qiladi va `message:new` hammasiga
  ketadi — katta kanallar uchun sahifalash/Redis kerak bo'ladi.
- Chiqarilgan/chiqib ketgan foydalanuvchi ochiq kanalga qayta obuna bo'la oladi
  (ban ro'yxati yo'q). Egalikni o'tkazish yo'q (owner faqat o'chira oladi).
- Xabar o'chirilganda o'qilmagan son/oxirgi xabar o'zgarsa, mijoz chatni qayta
  yuklaydi (har a'zodan bitta so'rov).
- MinIO CORS: brauzerdan `PUT` uchun MinIO'ning standart ochiq CORS'iga tayanilgan;
  ishlab chiqarishda (Caddy ortida) `MINIO_API_CORS_ALLOW_ORIGIN` ni veb domeniga
  cheklash kerak.
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

### 2-fazada nima tekshirildi
- `npx turbo run lint typecheck test build` — yashil (core 27, client 20, api 34,
  web 32 unit test).
- `npm run test:e2e -w @suhbat/api` (lokal Postgres 16) — 12 test yashil: guruh/kanal
  hayot sikli va rollar, kanalda yozish cheklovi, ochiq kanal qidiruvi/obuna,
  tahrirlash/o'chirish + WS voqealari, media oqimi (imzolangan URL, hajm/MIME
  rad etish, biriktirmani qayta ishlatish, o'chirilganda fayl o'chishi),
  `/users/search` email, socket token muddati (server uzadi → mijoz refresh
  qilib qayta ulanadi; server taymeri o'chirilsa test yiqiladi).
- Brauzerda (Playwright, Chromium, ikki foydalanuvchi, lokal API + Vite):
  guruh yaratish, real vaqtda chat paydo bo'lishi, xabar, tahrirlash/o'chirish,
  rasm/PDF/ovozli xabar (Chromium soxta mikrofon), HTML rad etilishi, admin
  tayinlash, kanal yaratish/obuna/yozish cheklovi; mobil (390 px) va qorong'i rejim.
- **Tekshirilmagan / farq:** lokal muhitda Docker Hub/quay'dan rasm olib bo'lmadi
  (429/403), shuning uchun **haqiqiy MinIO lokal sinalmadi**: lokal e2e va brauzer
  tekshiruvi imzoni tekshirmaydigan soxta S3 bilan (`test/helpers.ts`). Haqiqiy
  MinIO bilan e2e faqat GitHub CI'da (compose'dagi `minio` xizmati ham lokal
  ko'tarilmagan). Lokal Postgres 16 (CI/compose'da 17). Brauzerdan MinIO'ga
  `PUT` (CORS), Safari/Firefox'da ovoz yozish, bir nechta API nusxasi, Netlify
  deploy sinalmagan.

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

**2. Guruh, kanal, media** — ✅ bajarildi (2026-10-11), cheklovlar yuqorida
- Guruh/kanal, rasm/fayl/ovozli xabar, xabarni tahrirlash/o'chirish.

**3. Desktop va mobil**
- Electron build (GitHub Release'ga), RN CLI ilova (CI'da APK, crash ekrani).

**4. Bildirishnomalar va qo'ng'iroqlar**
- Push (FCM/APNs), keyin WebRTC qo'ng'iroqlar.

## Keyingi sessiya uchun
Repo: `suhbat`. "CLAUDE.md va docs/REJA.md ni o'qi, 3-fazani boshla
(desktop va mobil):
1. Avval ma'lum cheklovlardan: `PublicUser` (emailsiz) sxemasi, media uchun
   tugatilmagan yuklashlarni tozalash, rate limit (`@nestjs/throttler`).
2. `apps/desktop` — Electron: `apps/web` build'ini o'raydi (macOS, Windows),
   GitHub Release'ga build; tokenlar `TokenStorage` orqali (xavfsiz saqlash).
3. `apps/mobile` — bare React Native CLI (Android, iOS): `@suhbat/core` va
   `@suhbat/client` dan foydalanadi (`TokenStorage` — Keychain/Keystore,
   `UploadBody` — RN fayl tanasi); CI'da APK, crash ekrani.
4. Ilovalar bir-birini import qilmaydi; umumiy kod `packages/` da (kerak bo'lsa
   `packages/ui-tokens`)."
Ixtiyoriy: profilni tahrirlash (`PATCH /users/me`), veb bundle code-splitting,
egalikni o'tkazish, kanal ban ro'yxati.
