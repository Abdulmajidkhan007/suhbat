# suhbat — reja

> Oxirgi yangilanish: 2026-10-12 (3a-faza)

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
- **Rate limit (3a):** REST — `@nestjs/throttler`, IP **va endpoint** bo'yicha alohida
  hisob (standart 300/daqiqa; `login/register/refresh` — 10/daqiqa; `/health` cheklanmaydi);
  WS `message:send` — foydalanuvchi bo'yicha 30 / 10 soniya (`RateLimiter`, ack xatosi).
  Hisoblar **bitta API nusxasi xotirasida** (ko'p nusxa uchun Redis kerak). `typing`,
  `message:edit/delete` va media `upload-url` (umumiy REST limitidan tashqari) uchun alohida limit yo'q.
  Proksi ortida `TRUST_PROXY=<soni>` o'rnatilmasa hamma mijoz bir IP bo'lib ko'rinadi.
  Sozlash: `apps/api/.env.example`.
- "Yozmoqda" qabul qiluvchida 6 soniyada o'chadi; yuboruvchi har 3 soniyada
  yangilaydi.
- Profil tahrirlash API'si yo'q.
- **Email faqat o'zi uchun:** `PublicUser` (id, displayName, photoUrl, createdAt) —
  qidiruv, chat a'zolari, WS voqealari; `User` (email bilan) faqat `/auth/me` va
  login/register/refresh javoblarida. Xom HTTP/WS javoblarida email yo'qligi e2e
  bilan tekshiriladi (qasddan sizdirilsa test yiqiladi).
- **MinIO tarqatilishi:** MinIO rasm va binary nashr qilmaydi; biz manbadan quramiz
  (`docker/minio`, pin qilingan; CI'da qatlamlar GitHub Actions keshida, lokal
  birinchi qurish sekin). Uzoq muddatda S3-mos muqobilga
  (SeaweedFS, Garage) yoki boshqariladigan S3 (R2, Backblaze) ga o'tish ko'rib chiqilsin
  — API faqat S3 protokoliga tayanadi.
- **Media:** tugatilmagan yuklashlar (`messageId = null`, 24 soatdan eski) har soat
  tozalanadi (qator + obyekt, `MediaCleanupService`; o'chirish xatosi bo'lsa obyekt
  yetim qolishi mumkin — log). Foydalanuvchi kvotasi yo'q. Kanal/guruh o'chirilganda
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
- `npx turbo run lint typecheck test build` — yashil (core 29, client 20, api 35,
  web 33 unit test).
- `npm run test:e2e -w @suhbat/api` (lokal Postgres 16) — 13 test yashil: email sizmasligi (xom javoblar), guruh/kanal
  hayot sikli va rollar, kanalda yozish cheklovi, ochiq kanal qidiruvi/obuna,
  tahrirlash/o'chirish + WS voqealari, media oqimi (imzolangan URL, hajm/MIME
  rad etish, biriktirmani qayta ishlatish, o'chirilganda fayl o'chishi),
  `/users/search` email, socket token muddati (server uzadi → mijoz refresh
  qilib qayta ulanadi; server taymeri o'chirilsa test yiqiladi).
- Brauzerda (Playwright, Chromium, ikki foydalanuvchi, lokal API + Vite):
  guruh yaratish, real vaqtda chat paydo bo'lishi, xabar, tahrirlash/o'chirish,
  rasm/PDF/ovozli xabar (Chromium soxta mikrofon), HTML rad etilishi, admin
  tayinlash, kanal yaratish/obuna/yozish cheklovi; mobil (390 px) va qorong'i rejim.
- **Haqiqiy MinIO bilan lokal:** MinIO rasmi Docker Hub/quay'da ham, binary
  `dl.min.io` da ham yo'q (410), shuning uchun manbadan qurildi (`go install`,
  Go proxy orqali, pin: `v0.0.0-20260212201848-7aac2a2c5b7c`) va **13 e2e testning
  hammasi haqiqiy MinIO bilan o'tdi** (imzolangan PUT, imzodagi hajmga mos kelmagan
  yuklashni MinIO o'zi rad etishi, GET, o'chirish; brauzer CORS preflight javobi
  ham to'g'ri). `docker/minio/Dockerfile` (compose va CI shuni quradi) lokal
  **qurilmadi** — Docker Hub'dan `golang`/`alpine` rasmini tortib bo'lmaydi;
  faqat CI tekshiradi.
- **Tekshirilmagan / farq:** brauzerdan MinIO'ga haqiqiy `PUT` (brauzer tekshiruvi
  soxta S3 bilan o'tgan; preflight faqat curl bilan), Safari/Firefox'da ovoz
  yozish, bir nechta API nusxasi, Netlify deploy. Lokal Postgres 16
  (CI/compose'da 17).

### 3a-fazada nima qilindi
- **Desktop (`apps/desktop`, Electron 44):** veb kodini import qilmaydi — `apps/web/dist`
  `suhbat://app` maxsus sxemasi orqali yuklanadi (standard+secure; SPA marshrutlari
  `index.html` ga, `..` bilan chiqish rad etiladi, CSP sarlavhasi). API manzili veb
  build vaqtida (`VITE_API_URL`) qotadi; API'da `CORS_ORIGIN` ga `suhbat://app` kerak.
  `contextIsolation`, `sandbox`, `nodeIntegration: false`; preload faqat
  `window.suhbatDesktop = { platform, tokens }` beradi (`DesktopBridge`, `@suhbat/client`).
  Veb `window.suhbatDesktop?.tokens` bo'lsa `localStorage` o'rniga shuni ishlatadi.
- **Tokenlar:** Electron `safeStorage` bilan shifrlanib `userData/tokens.bin` ga (0600).
  Shifrlash mavjud bo'lmasa (Linux'da kalit ombori yo'q / `basic_text`) **ochiq matn yozilmaydi** —
  tokenlar saqlanmaydi, har ishga tushirishda qayta kirish kerak. IPC sender URL'i va token shakli tekshiriladi.
  Boshqa: tashqi havolalar tizim brauzerida, ilova ichida navigatsiya yo'q, ruxsatlardan faqat mikrofon.
- **Build:** `electron-builder` — macOS `dmg` (x64+arm64), Windows `nsis` (x64). CI: `check` job
  desktop lint/typecheck/test/build'ni ham qamraydi; `desktop-package` job Linux'da
  `--dir` qadoqlashni tekshiradi. `v*` tegi → `release-desktop.yml` macOS/Windows build qilib
  GitHub Release'ga yuklaydi (repo o'zgaruvchisi `SUHBAT_API_URL` shart).
- **Artefaktlar IMZOSIZ** (Apple Developer ID / notarizatsiya va Windows kod imzolash
  sertifikatlari yo'q): macOS'da Gatekeeper, Windows'da SmartScreen ogohlantiradi. Avto-yangilanish yo'q.
- **Tekshirildi:** `turbo run lint typecheck test build` (desktop 8 unit test: token ombori,
  `suhbat://` yo'l tahlili); API e2e 17 test (lokal Postgres 16, soxta S3) — jumladan 429 (auth va umumiy REST),
  WS `message:send` cheklovi, yetim yuklashni tozalash; Linux'da `electron-builder --dir` va
  qadoqlangan ilova Xvfb ostida Playwright bilan: oyna ochiladi, login ekrani chiqadi,
  `window.suhbatDesktop` bor, sahifada `require/process` yo'q, noto'g'ri token IPC rad etiladi.
- **Tekshirilmadi:** macOS dmg va Windows nsis build'lari (Linux konteynerda yo'q — faqat
  tag'da CI), haqiqiy `safeStorage` shifrlash aylanishi (konteynerda kalit ombori yo'q:
  Linux'da `set` jim o'tkazib yuboriladi), release workflow (tag bilan ishga tushirilmagan),
  desktop ↔ jonli API (CORS `suhbat://app`), ikonkalar (standart Electron ikonkasi), MinIO bilan
  tozalash e2e (soxta S3 bilan o'tgan).

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
- **3a ✅ (2026-10-12):** API cheklovlari (rate limit, yetim yuklashlarni tozalash) va
  `apps/desktop` (Electron). Quyida "3a-fazada nima qilindi".
- **3b ⏳:** RN CLI ilova (CI'da APK, crash ekrani) — "Keyingi sessiya uchun".

**4. Bildirishnomalar va qo'ng'iroqlar**
- Push (FCM/APNs), keyin WebRTC qo'ng'iroqlar.

## Keyingi sessiya uchun
Repo: `suhbat`. "CLAUDE.md va docs/REJA.md ni o'qi, 3b-fazani bajar (mobil):
1. `apps/mobile` — **bare React Native CLI** (Expo emas), Android va iOS. `@suhbat/core`
   va `@suhbat/client` dan foydalanadi (monorepo + Metro sozlamasi: workspaces, symlink).
   `TokenStorage` — Keychain/Keystore (masalan `react-native-keychain`); `UploadBody` —
   RN fayl tanasi (`createUpload` + `PUT`).
2. Minimal ishlaydigan oqim: kirish/ro'yxatdan o'tish, chatlar ro'yxati, xabarlar, real vaqt
   (Socket.IO), "yozmoqda", o'qildi. Dizayn tokenlari umumiy bo'lsa `packages/ui-tokens`.
3. CI: Android APK (debug) build; iOS build macOS runner'da (imzosiz simulyator) — iloji bo'lsa.
   Crash ekrani (error boundary). Release APK imzolash — keyin.
4. Ilovalar bir-birini import qilmaydi; umumiy kod `packages/` da. `apps/mobile` Turborepo
   `lint/typecheck/test` ga kirsin (build — alohida job).
Ixtiyoriy: profilni tahrirlash (`PATCH /users/me`), veb bundle code-splitting,
egalikni o'tkazish, kanal ban ro'yxati, desktop ikonkalari va imzolash, avto-yangilanish."
