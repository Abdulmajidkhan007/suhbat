# suhbat — reja

> Oxirgi yangilanish: 2026-10-13 (veb Railway'ga o'tkazildi)

## Hozirgi holat (koddan)
- **Monorepo** (npm workspaces + Turborepo): `apps/web`, `apps/api`, `apps/desktop`,
  `apps/mobile`, `packages/core`, `packages/client`, `packages/ui-tokens`.
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
- Veb `VITE_API_URL` ni build vaqtida qotiradi; deploy sinalmagan; API hali hech qayerga joylanmagan (tayyorgarlik — pastdagi "Deploy" bo'limi).

### Deploy tayyorgarligi (4-fazadan oldin)
- **Qaror:** API + Postgres — **Railway** (Docker); media — **Cloudflare R2** (yoki Railway Buckets, sinalmagan);
  veb — **Railway** (2026-10-13 egasi qarori: Netlify emas; API va Postgres bilan bitta loyiha).
  Qadamlar: `QADAMLAR.md` (egasi uchun, oddiy tilda) va `docs/DEPLOY.md` (texnik tafsilot);
  egasi bajaradi — Railway/R2/GitHub akkauntlariga men kira olmayman.
- **Veb Railway xizmati:** `apps/web/Dockerfile` (kontekst — repo ildizi; `VITE_API_URL` build arg;
  runtime `caddy:2-alpine`, non-root, `$PORT`, SPA fallback, `/assets/*` uchun immutable kesh),
  `apps/web/railway.toml` (config path `/apps/web/railway.toml`, healthcheck `/`), CI'da `web-image` job.
  `.dockerignore` dan `apps/web` olib tashlandi. Netlify (`netlify.toml`, `_redirects`) o'chirildi.
  Lokal tekshirildi: Caddy runtime konteyneri (`$PORT`, 200 `/`, SPA fallback, gzip, immutable kesh,
  uid 65534) host'da qurilgan `dist` bilan; **to'liq `docker build` lokal tekshirilmadi** (sandbox
  konteynerida npm tarmog'i yo'q) — build bosqichi CI `web-image` jobida tekshiriladi.
- `apps/api/Dockerfile` (ko'p bosqichli, `node:22-slim`, non-root; kontekst — repo ildizi) va
  `apps/api/railway.toml` (Dockerfile yo'li, `/health`, watch paths; xizmatda config path `/apps/api/railway.toml`,
  Root Directory bo'sh). Ishga tushishda `prisma migrate deploy` keyin `node dist/main.js`; `PORT` Railway'dan.
  `prisma` CLI `dependencies` ga ko'chirildi (runtime'da migratsiya uchun kerak).
- Media: `S3_FORCE_PATH_STYLE` (standart `true`); saqlashga ulanib bo'lmasa xabarga biriktirish endi 500 emas,
  tushunarli 503 ("Fayl saqlash hozir mavjud emas"); saqlash yo'q bo'lsa API baribir ko'tariladi (logda ogohlantirish).
- CI: `api-image` job (image quriladi, Postgres bilan ishga tushadi, migratsiya + `/health`, non-root).
- `release-desktop.yml` → `release.yml`: `v*` tegida desktop (mac/win) + Android APK → GitHub Release.
  Android imzosi: `ANDROID_KEYSTORE_*` secret'lari bo'lsa o'z kaliti bilan, bo'lmasa vaqtinchalik kalit
  ("sinov uchun" nomli APK). `SUHBAT_API_URL` repo o'zgaruvchisi hamma build'ga qotadi (bo'lmasa release yiqiladi).
  Gradle: `ANDROID_KEYSTORE_PATH` va `ANDROID_VERSION_NAME/CODE` env'dan. `mobile.yml` imzolash yo'lini ham tekshiradi.
- **Tekshirildi:** `docker build` (lokal; Docker Hub 429 bergani uchun mirror rasm va proksi bilan, `apt` qadamisiz
  nusxada) → konteyner haqiqiy Postgres 16 bilan: 3 migratsiya qo'llandi, `/health` ok, ro'yxatdan o'tish ishladi,
  non-root (uid 1000), S3 yo'q — API ko'tarildi. Image ~870 MB (asosan Prisma paketlari; kichraytirish mumkin).
- **Tekshirilmadi:** Dockerfile'dagi `apt-get install openssl ca-certificates` qadami lokal (tarmoq cheklovi) —
  faqat CI; Railway'da deploy (API va veb), `TRUST_PROXY=1` yetarliligi, R2/Buckets bilan haqiqiy yuklash va CORS,
  `v*` teg bilan release (mac/win/Android), haqiqiy keystore bilan imzolash.

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
- **Tekshirilmagan:** mobil brauzer/kichik ekran, veb Railway deploy'i, bir nechta
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
  yozish, bir nechta API nusxasi, veb Railway deploy'i. Lokal Postgres 16
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
  `--dir` qadoqlashni tekshiradi. `v*` tegi (yoki qo'lda Run workflow, `tag` input) → `release.yml` macOS/Windows build qilib
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
  Linux'da `set` jim o'tkazib yuboriladi), release workflow (na tag bilan, na `workflow_dispatch` bilan haqiqiy ishga tushirilmagan; faqat actionlint o'tdi; mavjud release'ga `upload --clobber` yo'li ham sinalmagan),
  desktop ↔ jonli API (CORS `suhbat://app`), ikonkalar (standart Electron ikonkasi), MinIO bilan
  tozalash e2e (soxta S3 bilan o'tgan).

### 3b-fazada nima qilindi (mobil)
- **`apps/mobile` — bare React Native CLI 0.87.1** (Expo emas; `@react-native-community/cli init`
  shabloni, yangi arxitektura + Hermes). Android `uz.suhbat.app`, iOS `Suhbat` (min iOS 15.1).
  `react` aynan **19.2.3** (RN renderer versiyasi; veb 19.3).
- **Oqim:** kirish/ro'yxatdan o'tish (zod tekshiruv), sessiyani tiklash (`/auth/me`), chatlar ro'yxati
  (oxirgi xabar, o'qilmaganlar, onlayn nuqta, "yozmoqda", tortib yangilash), foydalanuvchi qidirib
  1:1 chat ochish, chat ekrani (sahifalab eski xabarlar, optimistik yuborish → ack, xato bo'lsa
  bosib qayta yuborish, "yozmoqda" yuborish/ko'rsatish, o'qildi belgisi va ✓/✓✓, guruhda yuboruvchi
  ismi, kanalda oddiy a'zoga yopiq composer), qayta ulanganda chatlar va ochiq chat qayta yuklanadi.
  Holat — `useReducer` + sof reducer (`src/state/chatState.ts`), socket voqealari `ChatStoreProvider`da.
- **Yo'q (ataylab):** media yuborish (fayl/rasm tanlash native modul talab qiladi; biriktirma faqat
  ko'rsatiladi va bosilganda tizim brauzerida ochiladi), xabarni tahrirlash/o'chirish UI, guruh/kanal
  yaratish va boshqarish, profil, push bildirishnoma. Navigatsiya — o'zimizning 3 ekranli stek
  (`BackHandler` bilan); ekranlar ko'payganda React Navigation'ga o'tiladi.
- **Tokenlar:** `react-native-keychain` (iOS Keychain / Android Keystore, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`,
  xizmat `uz.suhbat.tokens`) + xotira keshi. `@suhbat/client` o'zgarishsiz ishlatildi.
- **API manzili:** build (bundle) vaqtida `SUHBAT_API_URL` — o'zimizning babel plagini
  (`babel/inline-api-url.js`, faqat shu bitta o'zgaruvchi) almashtiradi; Metro `cacheVersion` qiymatga
  bog'langan. Standart: Android emulyator `http://10.0.2.2:4000`, iOS simulyator `http://localhost:4000`.
  `react-native-config` (native modul) ishlatilmadi.
- **Crash ekrani:** `ErrorBoundary` (render xatosi → "Qayta urinish"; dev'da xato matni). Global JS
  xato ishlovchisi va crash reporting (Sentry va h.k.) yo'q.
- **Dizayn tokenlari:** `packages/ui-tokens` (palitra yorug'/qorong'i, spacing, radius, shrift) —
  veb MUI mavzusi ham shundan oladi. Mobil tizim rejimiga (`useColorScheme`) ergashadi.

### Monorepo + RN qarori (hoisting)
- npm workspaces RN paketlarini **root `node_modules` ga hoist qiladi** — nohoist qilinmadi, yo'llar
  qattiq yozilmaydi, **Node resolution** bilan topiladi:
  - Metro: `watchFolders` = root `node_modules` + `packages/`; `nodeModulesPaths` = ilova, keyin root.
    `@suhbat/*` dist (ESM, `exports`) Metro orqali to'g'ridan-to'g'ri bundle qilinadi.
  - **`react` pin:** `resolveRequest` har qanday `react`/`react/*` importini ilovaning o'z nusxasiga
    (`apps/mobile/node_modules/react`, 19.2.3) yo'naltiradi — root'dagi veb `react` (19.3) bundle'ga
    tushmaydi (bundle'da faqat 19.2.3 tekshirildi). Jest'da xuddi shu `moduleNameMapper`.
  - Gradle: `settings.gradle` (`@react-native/gradle-plugin`) va `app/build.gradle`
    (`reactNativeDir`, `codegenDir`, `cliFile`, `hermesCommand` ← `hermes-compiler`) `node --print
    require.resolve(...)` bilan. iOS: shablon Podfile allaqachon `require.resolve` ishlatadi.
  - zod 4 uchun `@babel/plugin-transform-export-namespace-from` (RN preset `export * as` ni o'girmaydi).
- Testlar: jest 29 + `@react-native/jest-preset` + RN Testing Library 14 (`test-renderer` 1.2 — React 19.2).

### 3b-fazada nima tekshirildi
- `npx turbo run lint typecheck test build` — yashil (mobil: 19 jest testi — reducer, Keychain ombori,
  API manzili, crash ekrani, App oqimi soxta API/socket bilan: kirish → ro'yxat → chat, real vaqt
  xabar, "yozmoqda", markRead, optimistik yuborish → ✓ → ✓✓, kanalda yopiq composer).
- `react-native bundle` (android, ios, `--dev false`) lokal — native'siz; `SUHBAT_API_URL` bundle'ga qotishi.
- GitHub Actions `Mobile` workflow: **Android** — `assembleDebug` + imzosiz `assembleRelease`
  (arm64-v8a, x86_64; release APK ichida `index.android.bundle` borligi tekshiriladi), debug APK
  artefakt (7 kun). **iOS** — `pod install` + `xcodebuild` Debug, simulyator, imzosiz.
- **Tekshirilmagan:** ilova **hech qanday emulyator, simulyator yoki haqiqiy qurilmada ishga
  tushirilmagan** (konteynerda Android SDK/Xcode yo'q; CI faqat build qiladi) — jonli API bilan
  kirish, Socket.IO (RN WebSocket), Keychain/Keystore haqiqiy aylanishi, klaviatura/safe-area,
  qorong'i rejim ko'rinishi, Android "orqaga" tugmasi faqat kod va jest darajasida. iOS Release build
  (Hermes bytecode) CI'da yo'q. Release APK imzolanmagan (keystore — keyin, CI secret orqali).

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
- **3b ✅ (2026-10-12):** `apps/mobile` (bare RN CLI) — asosiy chat oqimi, Keychain, CI'da Android
  APK va iOS simulyator build, crash ekrani; `packages/ui-tokens`. Qurilmada sinalmagan — yuqorida.

**4. Bildirishnomalar va qo'ng'iroqlar**
- Push (FCM/APNs), keyin WebRTC qo'ng'iroqlar.

## Keyingi sessiya uchun
Repo: `suhbat`. "CLAUDE.md va docs/REJA.md ni o'qi, 4-fazani bajar (push bildirishnomalar):
1. **API:** qurilma tokenlari (`DeviceToken`: userId, platform `android|ios|web`, token, updatedAt;
   `POST/DELETE /devices`, logout'da o'chirish). Xabar kelganda **onlayn bo'lmagan** (yoki chatni
   ochmagan) a'zolarga push: FCM HTTP v1 (Android, iOS ham FCM orqali yoki APNs to'g'ridan-to'g'ri —
   qarorni REJA'ga yoz). Kalitlar faqat env'da (`.env.example` namunasi), yaroqsiz token javobida o'chirish,
   kanalda katta auditoriya uchun navbat/batch. Matn ko'rinishi (preview) sozlamasi — maxfiylik.
2. **Mobil:** `@react-native-firebase/messaging` (yoki `@notifee` bilan) — ruxsat so'rash (Android 13+
   `POST_NOTIFICATIONS`, iOS), tokenni ro'yxatdan o'tkazish/yangilash, foreground'da in-app ko'rsatish,
   bildirishnomani bosganda shu chatni ochish. `google-services.json` / `GoogleService-Info.plist`
   **repoga tushmaydi** — CI secret'dan yoziladi, lokal uchun namuna/README.
3. **Veb/desktop (ixtiyoriy):** Web Push (service worker) — keyin ham bo'lishi mumkin.
4. Mobil 3b qoldiqlari (agar vaqt bo'lsa): haqiqiy emulyatorda sinash (CI'da Android emulyator
   smoke testi — `reactivecircus/android-emulator-runner`), release APK imzolash (keystore secret),
   media yuborish (rasm/fayl tanlash), xabarni tahrirlash/o'chirish UI.
Keyin (4b): WebRTC qo'ng'iroqlar (signal Socket.IO orqali, TURN server — coturn)."

### Deploy'dan keyingi navbat (tekshiruvchi tartibi, 2026-10-13)
1. **4-faza:** push bildirishnomalar (FCM/APNs), keyin WebRTC qo'ng'iroqlar — yuqoridagi "Keyingi sessiya uchun" shundan boshlanadi.
2. **Mobil:** media yuborish, xabarni tahrirlash/o'chirish, guruh boshqaruvi + haqiqiy qurilmada sinov.
3. **Do'konlar:** Play Store uchun doimiy keystore; iOS release / App Store.
4. **Desktop:** ikonkalar, kod imzosi (Apple/Windows), avto-yangilanish.
5. **Redis:** ko'p API nusxasi, presence va rate limit.
6. **Profil tahrirlash** (`PATCH /users/me`), veb code-splitting.

Boshqa ixtiyoriy: egalikni o'tkazish, kanal ban ro'yxati.
