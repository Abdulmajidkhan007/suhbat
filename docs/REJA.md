# suhbat — reja

> Oxirgi yangilanish: 2026-10-16 (username va parolni tiklash — pastdagi "Auth: username va parolni tiklash"; undan oldin v0.1.2 tuzatishlari)

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
  Google/telefon bilan kirish — "tez orada". Profil tahriri — v0.1.2 (pastda).
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
- Profil: faqat ism va bio (`PATCH /users/me`); avatar yuklash yo'q (S3 sozlanmagan). Ism/bio o'zgarsa boshqa foydalanuvchilar
  ochiq chatlarda eski ismni sahifa/ro'yxat yangilanguncha ko'radi (WS voqeasi yo'q).
- **Email faqat o'zi uchun:** `PublicUser` (id, displayName, username, photoUrl, bio, createdAt) —
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

### 4-faza (push bildirishnomalar) — nima qilindi
- **Qaror: iOS ham FCM orqali** (APNs to'g'ridan-to'g'ri emas). APNs `.p8` kaliti Firebase'ga yuklanadi;
  server bitta FCM HTTP v1 API bilan Android, iOS (va keyin veb) ga yuboradi. Kutubxona (`firebase-admin`)
  ishlatilmadi: `FcmClient` service account bilan RS256 JWT imzolaydi → OAuth token (keshlanadi).
- **API:** `DeviceToken` (userId, platform `android|ios|web`, token unique, updatedAt), `POST /devices`
  (upsert — token boshqa hisobga o'tadi), `DELETE /devices/:token` (faqat o'ziniki), `/auth/logout` da
  ixtiyoriy `deviceToken`. Xabar kelganda **socket'i yo'q** a'zolarga push (`ChatGateway.emitMessageNew`
  dan, `void` — javob kutmaydi). Sarlavha: 1:1 — yuboruvchi; guruh — guruh nomi, matn "Ism: matn";
  kanal — kanal nomi. Biriktirma: "📷 Rasm", "📎 Fayl", "🎤 Ovozli xabar". `data`: `{ type, chatId, messageId }`
  (`PushDataSchema`); Android `tag` / iOS `thread-id` = chatId.
  Katta auditoriya: a'zolar 1000 tadan bo'laklab o'qiladi va yuboriladi, parallellik `FCM_CONCURRENCY` (20).
  Yaroqsiz token (404, `UNREGISTERED`, `SENDER_ID_MISMATCH`, "registration token" INVALID_ARGUMENT) — o'chiriladi.
  `FCM_SERVICE_ACCOUNT_JSON` yo'q/yaroqsiz — push o'chiq, API ko'tariladi (logda ogohlantirish).
- **Maxfiylik:** `User.notificationPreview` (standart `true`), `GET/PATCH /users/me/notifications` `{ preview }`;
  `false` — "Suhbat / Yangi xabar" (matn va yuboruvchi FCM'ga umuman ketmaydi).
- **Bloklash (yangi, minimal):** `UserBlock`, `POST/DELETE /users/:id/block`, `GET /users/blocked`.
  Ikki tomonlama: bir-biriga push yo'q; 1:1 da hech biri yozolmaydi (403, yuklash URL'i ham).
  Guruh/kanalda xabarlar ko'rinaveradi (faqat push yo'q). Veb/mobilda bloklash UI'si **yo'q**.
- **Mobil:** `@react-native-firebase/app` + `messaging` 26.4 (notifee'siz). Kirgandan keyin ruxsat
  (Android 13+ `POST_NOTIFICATIONS`, iOS) → token → `POST /devices`; `onTokenRefresh`; logout — serverdan va
  FCM'dan o'chiriladi. Foreground — o'zimizning in-app banner (shu chat ochiq bo'lsa yo'q, 4 s), bosilganda chat;
  fon/yopiq holatdan bosilganda ham chat ochiladi. Android kanali `messages` ("Xabarlar").
  Firebase fayllari repoda yo'q: Gradle plagini va iOS `FirebaseApp.configure()` faqat fayl bo'lsa; CI
  `GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICE_INFO_PLIST` secret'laridan yozadi, bo'lmasa push'siz build.
  iOS Podfile: static frameworks + CocoaPods (`$RNFirebaseDisableSPM`). Yo'riqnoma: `apps/mobile/README.md`,
  egasi qadamlari: `QADAMLAR.md` 12-bo'lim.
- **Tekshirildi:** `turbo run lint typecheck test` yashil (api unit 59 — FcmClient: JWT imzosi, token keshi, 401,
  xato tasnifi; PushService: preview, bloklash so'rovi, bo'laklash, yaroqsiz token; mobil jest 26 — token
  ro'yxati/yangilash, ruxsat yo'q, banner, bosilganda chat, logout). API e2e 24 (lokal Postgres 16), shundan
  `push.e2e-spec.ts` 7 ta — soxta FCM bilan: device upsert/ko'chish/o'chirish, oflayn → push, onlayn → yo'q,
  sekin FCM javobni bloklamaydi, preview o'chiq, guruh sarlavhasi va bloklash, yaroqsiz token, logout.
  `react-native bundle` (android) lokal. CI: `Mobile` workflow — Android (debug + release APK, push'siz,
  `google-services.json` yo'q) va iOS simulyator build (static frameworks + Firebase) yashil.
  Android job Firebase qo'shilgach ikki marta logsiz yiqildi (runner yo'qoldi — disk/xotira bo'lishi ehtimol,
  aniq sabab ko'rinmadi); job boshida keraksiz SDK'lar o'chiriladi va `--max-workers=3` — shundan keyin yashil.
- **Tekshirilmagan:** haqiqiy FCM (Google'ga so'rov — faqat soxta), **haqiqiy qurilma/emulyatorda push
  qabul qilish**, iOS APNs/entitlement, iOS native build (static frameworks) — faqat CI'da quriladi.
  `release.yml` ga `GOOGLE_SERVICES_JSON` v0.1.1 da ulandi (secret bo'lsa push bilan; haqiqiy secret bilan sinalmagan).
- **Cheklovlar:** "onlayn" — bitta API nusxasi xotirasidagi presence (ko'p nusxada Redis kerak); socket ulangan,
  lekin ilova fonda bo'lsa (iOS socket'ni tez uzadi, Android ba'zan saqlaydi) push kelmasligi mumkin; chat ochiq
  bo'lishidan qat'i nazar oflayn a'zoga har xabarga push (mute/sozlama yo'q); push navbati xotirada
  (API qayta ishga tushsa yuborilmagan push yo'qoladi, qayta urinish yo'q); token egasini almashtirish (upsert)
  tokenni bilgan har kim uchun ochiq. Xabar o'qilganda bildirishnoma qurilmadan olib tashlanmaydi.
- **Web Push — keyin** (service worker + VAPID/FCM web; `platform: 'web'` API'da tayyor).

### v0.1.1 (2026-10-14) — v0.1.0 sinovidan keyingi tuzatishlar
- **Muammo (egasi telefonda):** ro'yxatdan o'tishda "Tarmoq xatosi" — `SUHBAT_API_URL` `https://` siz edi
  (`suhbatapi-production.up.railway.app`), ilova so'rovni nisbiy manzilga yuborgan. Ikonka — shablondagi yashil robot.
- **API URL:** `normalizeApiUrl` endi `@suhbat/client` da (veb va mobil umumiy): trim, oxiridagi `/`, sxemasiz
  hostga `https://` (unit test: client 3, mobil 1). Veb `VITE_API_URL` bo'sh satr bo'lsa ham standartga tushadi.
  `scripts/check-api-url.sh` — release'da desktop va android job'lari bo'sh/sxemasiz/bo'sh joyli qiymatda yiqiladi,
  android uchun faqat `https://` (`https-only`). CI `check` job skriptni yaxshi/yomon qiymatlar bilan sinaydi.
  `mobile.yml` `SUHBAT_API_URL` ishlatmaydi (standart dev manzillar) — u yerda URL tekshiruvi yo'q.
- **Cleartext:** RN Gradle plagini release'da `usesCleartextTraffic=false`, debug'da `true` qiladi
  (`AgpConfiguratorUtils.kt`); endi `scripts/verify-apk.sh` buni release APK manifestidan (`aapt2 dump xmltree`) tekshiradi.
- **Ikonka:** manba `assets/brand/icon.svg` (+ adaptive qatlamlar `icon-background.svg`, `icon-foreground.svg`),
  generatsiya `npm run icons` (`scripts/gen-icons.mjs`, `sharp` root devDependency; ICO/ICNS o'zimiz yozamiz —
  ichida PNG). Natijalar commit qilingan: Android `mipmap-*` (ic_launcher, _round, _foreground, _background) +
  `mipmap-anydpi-v26`, iOS `AppIcon.appiconset` (alfa'siz), desktop `apps/desktop/resources/icon.{png,icns,ico}`
  (`build/` .gitignore'da bo'lgani uchun `resources/`; electron-builder `buildResources` va `mac/win/linux.icon`),
  veb favicon.ico/icon.svg/logo192/512/apple-touch-icon/maskable + manifest (`theme_color` #3B82F6).
  Android 12+ ishga tushish ekrani foni `@color/brand_primary` (`values-v31/styles.xml`); Android 11 va pastda
  oq/qora fon o'zgarmadi; iOS LaunchScreen o'zgarmadi.
  `scripts/verify-apk.sh` (mobile.yml va release.yml): JS bundle, `mipmap/ic_launcher(_round)` adaptive,
  foreground/background resurslari APK'da, cleartext o'chiq.
- **release.yml android:** `GOOGLE_SERVICES_JSON` env (Gradle faylni yozadi), yo'q bo'lsa `::warning`;
  diskda joy bo'shatish va `--max-workers=3` (mobile.yml dagi kabi). Release matni `CHANGELOG.md` dagi teg bo'limidan.
- **QADAMLAR.md:** 8 — `SUHBAT_API_URL` to'g'ri/noto'g'ri misollar; 9 — Termux bilan keystore (openjdk-17, keytool,
  base64, 4 secret), maxfiylik va zaxira ogohlantirishi.
- **Tekshirildi (lokal):** `turbo run lint typecheck test build` yashil; ikonkalar ko'zda (kontakt varag'i);
  ICNS/ICO Pillow bilan o'qildi (11 va 7 o'lcham); `check-api-url.sh` qo'lda.
  CI (PR #10) yashil: check, desktop-package, web/api-image, Mobile android + ios. Android release APK
  (`verify-apk.sh`, `aapt2`): `label='Suhbat'`, `mipmap/ic_launcher` — 5 zichlik PNG + `anydpi-v26` XML
  (AGP resurs yo'llarini qisqartiradi: `res/BW.xml`), `usesCleartextTraffic=false`.
- **Tekshirilmadi:** ikonka haqiqiy telefon/launcher'da, macOS dmg / Windows exe ichidagi ikonka (faqat release
  teg'ida quriladi), iOS build'da AppIcon (CI ios job Debug simulyator), haqiqiy `GOOGLE_SERVICES_JSON` bilan
  release, haqiqiy keystore.

### 4b-faza (1:1 qo'ng'iroqlar, WebRTC) — nima qilindi
- **Kontrakt (`@suhbat/core` `calls.ts`):** `call:invite|ringing|accept|reject|cancel|end|offer|answer|ice|busy`
  zod sxemalari, tugash sabablari (`hangup|rejected|cancelled|missed|busy|disconnected|answered_elsewhere`),
  `IceServersResponse`, `callSummaryText` / `formatCallDuration`. `callId` — mijoz UUID'i (ack kelmasdan oldingi
  voqealarni ham taniydi). `PushData` — `message | call` (discriminated union).
- **API (`apps/api/src/calls`):** `CallsGateway` (o'sha Socket.IO server, auth — `ChatGateway` middleware'i),
  `CallRegistry` — **xotirada, bitta API nusxasi** (ko'p nusxa uchun Redis — keyin). Qoidalar: faqat 1:1 chat
  a'zolari, bloklangan bo'lsa 403 matni; foydalanuvchi bir vaqtda bitta qo'ng'iroqda (qabul qiluvchi band —
  `call:busy`, o'zi band — ack xatosi); `CALL_RING_TIMEOUT_MS` (45 s) javob bo'lmasa `missed`; qabul qilingach
  boshqa qurilmalarga `answered_elsewhere`; signal (offer/answer/ice) faqat qo'ng'iroqqa bog'langan ikki socket
  orasida (qabul qilinmagan qo'ng'iroqda — yo'q); bog'langan socket uzilsa — `cancelled` (jiringlayotganda) yoki
  `disconnected`. `call:invite` cheklovi 10/daqiqa (`CALL_INVITE_LIMIT`). Socket qayta ulanganda (masalan push
  bosilib) jiringlayotgan qo'ng'iroq `call:invite` bilan qayta yuboriladi.
  Faol qo'ng'iroq socket'i access token tugaganda **uzilmaydi** (`ConnectionHoldService`; har 5 s qayta
  tekshiriladi, qo'ng'iroq tugagach uziladi) — aks holda har 15 daqiqada qo'ng'iroq uzilardi. Bu — ongli
  murosa: shu socket token muddatidan keyin ham qo'ng'iroq davomida ochiq qoladi.
  Tugaganda chatga **tizim xabari** (`type: system`, yuboruvchi — chaqiruvchi): "📞 Qo'ng'iroq, 3:12",
  "🎥 Video qo'ng'iroq, …", "Javobsiz" (missed/busy), "Rad etilgan", "Bekor qilingan". Davomiylik —
  server vaqti, qabul qilingandan (media ulangandan emas). Tizim xabari tahrirlanmaydi, push yubormaydi.
- **Push:** qabul qiluvchi oflayn bo'lsa `PushService.notifyIncomingCall` — `data: { type: 'call', callId,
  chatId, media }`, Android kanali `calls`, `ttl` = jiringlash vaqti (Android `ttl`, APNs `apns-expiration`),
  preview o'chiq bo'lsa ism yashiriladi. **Data-only emas** (vazifada data-only so'ralgan edi): notifee/CallKit
  yo'qligi sababli data-only xabarni ilova fonda ko'rsata olmaydi — foydalanuvchi hech narsa ko'rmasdi.
  Shuning uchun `notification + data`; CallKit/ConnectionService qo'shilganda data-only'ga o'tiladi.
- **ICE:** `GET /calls/ice-servers` (auth, `no-store`): STUN (`STUN_URLS`, standart Google) + TURN
  (`TURN_URLS` + `TURN_USERNAME/TURN_CREDENTIAL` yoki `TURN_SECRET` → coturn REST credential,
  `TURN_TTL_SECONDS` standart 12 soat). Egasi uchun variantlar — `QADAMLAR.md` 13. **TURN hali sozlanmagan.**
- **`@suhbat/client`:** `CallSession` — holat mashinasi `idle → calling/ringing → connecting → connected → ended`,
  offer/answer/ICE (remote description'gacha ICE navbati), mikrofon/kamera o'chirish, kamerani almashtirish
  (adapter bersa), ICE `disconnected` → "Aloqa tiklanmoqda…", `failed` → tugatish. `RTCPeerConnection`,
  `getUserMedia` va socket **adapter orqali injeksiya** qilinadi. `createCallManager` — joriy sessiya, socket
  voqealarini yo'naltirish, tugagan ekranni 1.5 s ushlab turish. `callStatusText`, `isSilentEnd` — veb/mobil umumiy.
- **Veb/desktop:** brauzer adapterlari (`services/webrtc.ts`), chat sarlavhasida 📞/🎥 (faqat 1:1, band bo'lsa
  o'chiq), kiruvchi oyna (qabul/rad), qo'ng'iroq ekrani (MUI, mobil kenglikda to'liq ekran; masofadagi video
  + o'z kamerasi PiP, mikrofon/kamera, taymer, tugatish), tizim xabari markazda. Vebda kamerani almashtirish yo'q.
  `getUserMedia` faqat HTTPS/localhost'da — aks holda tushunarli xato.
  Electron: `setPermissionRequestHandler` — faqat o'z sahifasiga va faqat `media` (audio/video), +
  `setPermissionCheckHandler`; macOS `extendInfo` — `NSMicrophoneUsageDescription`, `NSCameraUsageDescription`.
- **Mobil:** `react-native-webrtc` 124.0.8 (adapterlar `src/calls/nativeWebrtc.ts`; kutubxona event-target
  tiplarini nashr qilmagani uchun `on*` xususiyatlari bilan), Android ruxsatlari (`RECORD_AUDIO`, `CAMERA`,
  `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH_CONNECT` ixtiyoriy; kamera `required=false`), `calls` kanali
  (`MainApplication.kt`), iOS Info.plist matnlari. Kiruvchi/chiquvchi ekran (`CallOverlay`, `RTCView`),
  Android "orqaga" qo'ng'iroq paytida ekrandan chiqarmaydi; foreground'da qo'ng'iroq push'i banner emas.
- **Tekshirildi (lokal):** `turbo run lint typecheck test build` yashil (core 42, client 40, api unit 73,
  web 46, desktop 10, mobil 31). API e2e 32 (lokal Postgres 16), shundan `calls.e2e-spec.ts` 8 ta — ikki/uch
  socket mijoz bilan: invite → ringing → accept → offer/answer/ice → end (+ ikkinchi qurilmaga
  `answered_elsewhere`, begona socket signal yubora olmasligi, tizim xabari), rad/bekor, busy, timeout (+ oflayn
  push va qayta ulanganda invite qayta kelishi), uzilish, ruxsatsiz (guruh, a'zo emas, bloklangan, validatsiya,
  begona accept/end), token tugaganda socket uzilmasligi, `/calls/ice-servers`.
  **Brauzerda (Playwright, Chromium, soxta kamera/mikrofon, lokal API + `vite preview`, ikki foydalanuvchi):**
  video qo'ng'iroq haqiqatan ulandi — ikkala tomonda masofadagi `<video>` kadrlar oldi (480×270, trek'lar
  `live`), taymer, tugatish, tizim xabari "🎥 Video qo'ng'iroq, 0:03"; ovozli qo'ng'iroqni rad etish; mobil
  kenglik (390 px). Bu bitta mashinada (localhost, host ICE nomzodlari) — NAT/TURN orqali emas.
  `react-native bundle` (android) lokal.
  CI (PR #11) yashil: check (API e2e — MinIO bilan), api-image, web-image, desktop-package, Mobile android
  (debug + release APK, `react-native-webrtc` bilan) va ios (simulyator, `JitsiWebRTC` pod bilan) — faqat build.
- **Tekshirilmagan:** haqiqiy qurilmada (Android/iOS) qo'ng'iroq — ilova hech qachon qurilmada ishga
  tushirilmagan; turli tarmoqlar (NAT, mobil internet), TURN (sozlanmagan); Electron oynasida qo'ng'iroq va macOS
  ruxsat oynasi; Safari/Firefox; haqiqiy FCM bilan qo'ng'iroq push'i; uzoq qo'ng'iroq. **Haqiqiy media oqimi
  CI'da sinalmaydi** (CI faqat signal e2e, unit va build).
- **Cheklovlar / keyin:** CallKit (iOS) / ConnectionService (Android) — tizim qo'ng'iroq ekrani, qulflangan
  ekranda jiringlash, data-only push; karnay/quloqchin almashtirish (`react-native-incall-manager`), fonda
  davom ettirish (iOS `UIBackgroundModes audio/voip`); jiringlash ovozi (veb ham, mobil ham — hozir ovozsiz,
  faqat ekran); ICE restart va socket qisqa uzilganda qayta tiklash (hozir bog'langan socket uzilsa qo'ng'iroq
  tugaydi); bir nechta API nusxasi (registr va presence — Redis); guruh qo'ng'iroqlari (SFU kerak);
  qo'ng'iroqlar tarixi alohida jadvalda emas (faqat tizim xabari); Cloudflare TURN credential'ini avtomatik
  yaratish.

### Javob berish (reply) — 2026-10-16
- **API:** `Message.replyToId` (nullable FK → `messages.id`, `ON DELETE SET NULL`, indeks; migratsiya `*_message_reply`).
  `POST /chats/:id/messages` va WS `message:send` da `replyToId?`. Faqat **shu chatdagi tirik** (o'chirilmagan, tizim emas)
  xabarga — aks holda 400 "Javob berilayotgan xabar bu suhbatda topilmadi" (begona chat xabari borligini oshkor qilmaydi).
  Javob qaytarishda `Message.replyTo` = `{ id, senderId, content (≤200, emoji o'rtasidan kesilmaydi), kind, deleted }`;
  asl xabar keyin o'chirilsa (soft-delete) — `deleted: true`, matn va tur yashirin. Tarix, oxirgi xabar, tahrir va ack'da ham.
- **Core:** `MessageReplySchema`, `REPLY_PREVIEW_MAX`, `MessageSchema.replyTo` — `nullish` (eski server javobini ham o'qiydi),
  `MessageBodySchema.replyToId`.
- **Mobil:** uzun bosish → "Javob berish" (yozish huquqi bo'lsa), composer ustida "Javob: Ism" paneli (✕), pufakda javob bloki
  (muallif rangi, matn boshi yoki "O'chirilgan xabar"); bosilsa asl xabarga o'tadi va qisqa yoritiladi, yuklanmagan bo'lsa — izoh.
  `message:deleted` kelganda javob bloklari "O'chirilgan xabar" bo'ladi. Qayta yuborishda `replyToId` saqlanadi.
- **Veb:** xabar menyusida "Javob berish", composer'da panel (✕/Escape), pufakda blok (o'z ko'k pufagida oq tus), bosilsa
  `scrollIntoView` + yoritish, yuklanmagan bo'lsa toast; chat almashganda panel yopiladi.
- **Testlar:** API e2e 48 (yangi: javob — WS/REST, boshqa chat/mavjud emas/yaroqsiz id/o'chirilgan → 400, o'chirilganda `deleted`,
  tahrirdan keyin saqlanadi, tarix va `lastMessage`), api unit (mapper: qisqartirish, o'chirilgan), core (sxema),
  mobil jest (`Reply.test.tsx` 3), veb (MessageBubble 3, messagesSlice 1, MessageComposer 1).
  Brauzerda (Playwright, lokal API + `vite preview`, ikki foydalanuvchi, 1280 va 390 px): javob → ikkinchi tomonda blok →
  asl xabar o'chirilgach "O'chirilgan xabar".
- **Cheklov:** sahifaga yuklanmagan (eski) asl xabarga avtomatik o'tish yo'q — foydalanuvchi "Eskiroq xabarlar"ni yuklaydi.
  Haqiqiy telefonda sinalmagan. `CHANGELOG.md` ga qator #13 merge bo'lgach qo'shiladi (konflikt bo'lmasligi uchun).

### Mobil dizayn yangilanishi — "Pulse UI" uslubi (2026-10-16)
- **Namuna:** egasining `uzbek-tg` reposi (bare RN, Telegram mijozi) — faqat UI/UX g'oyalari va rang/tipografiya qiymatlari olindi;
  kod suhbat arxitekturasiga qayta yozildi (TDLib, mock ma'lumotlar, zustand, react-navigation, reanimated olib kelinmadi).
  uzbek-tg'dagi `LICENSE` — Expo shablonining MIT matni; kalit/token yo'q. Ikonkalar — Ionicons 8 (MIT) SVG yo'llari.
- **Tema:** yorug'/qorong'i/tizim + 7 ta asosiy rang (Ko'k, Yashil, To'q sariq, Qizil, Binafsha, Feruza, Pushti), tanlov
  qurilmada saqlanadi (Keychain, tokenlardan alohida `service`). Palitra `@suhbat/ui-tokens` `Palette` ning kengaytmasi —
  login/register ekrani (boshqa ishchi sohasi) o'zgarmadi va yangi palitrada ishlaydi.
- **Navigatsiya:** pastki tablar (Suhbatlar / Sozlamalar, o'qilmagan suhbatlar belgisi) + stek; ekran o'tish animatsiyasi
  (RN `Animated`, native driver). Yangi ekranlar: chat ma'lumotlari, a'zo qo'shish, yangi guruh/kanal, sozlamalar, ko'rinish.
- **Chat ro'yxati:** avatar (id bo'yicha rang, kanalda ikonka), onlayn nuqta, vaqt (bugun 24h, "Kecha", hafta kuni, "3 mar"),
  "Siz:"/guruhda yuboruvchi prefiksi, ✓/✓✓ belgisi, o'qilmaganlar, "yozmoqda", bo'sh/yuklanish/xato holatlari, "Ulanmoqda…".
  Global qidiruv (suhbatlar, foydalanuvchilar, ochiq kanallar) saqlandi, yangi qatorlar bilan. Swipe amallari — **yo'q** (ixtiyoriy edi).
- **Chat:** pufaklar (dum, guruhda yuboruvchi rangli ismi), sana ajratgichlari, ✓/✓✓/⏱/! ikonkalari, "tahrirlangan",
  uzun bosish menyusi — nusxa olish, tahrirlash (o'z matni), o'chirish (o'zi yoki guruh/kanal admini, tasdiq bilan),
  yuborilmagan xabar uchun "Qayta yuborish"/"O'chirish"; xato/bo'sh holatlar; sarlavha bosilsa — chat ma'lumotlari.
  **"Javob berish" yo'q** — API'da `replyTo` maydoni yo'q (alohida ish: migratsiya + sxema + veb).
- **Chat ma'lumotlari:** 1:1 — bio, qo'ng'iroq; guruh/kanal — tavsif, ochiq/yopiq, a'zolar (kanalda faqat ega/adminlar),
  rollar, admin qilish/olish (ega), chiqarish (`canRemove`), a'zo qo'shish, nom/tavsif tahriri, chiqish/o'chirish.
- **Sozlamalar:** profil kartasi, profil tahriri, ko'rinish (jonli namuna), bildirishnoma matni (`/users/me/notifications`),
  chiqish (tasdiq), "Suhbat v{versiya}" (`package.json`).
- **Auth ekranlari (#14 dan keyin):** kirish/ro'yxatdan o'tish, "Parolni unutdim", `UsernameInput` — mantiq o'zgarmadi,
  faqat uslub Pulse temasiga moslandi (logo, to'ldirilgan maydonlar, tipografiya). Profil tahririda username maydoni saqlandi;
  qidiruv/yangi suhbat/a'zo qo'shish ro'yxatlarida `@username` ko'rsatiladi.
- **Qo'ng'iroq ekrani:** mantiq o'zgarmadi; emoji o'rniga vektor ikonkalar, asosiy rang tusidagi fon, yangi tipografiya.
- **Yangi native kutubxonalar:** `react-native-svg` 15.16, `@react-native-clipboard/clipboard` 1.16, `react-native-haptic-feedback` 3.0.
- **Testlar:** mobil jest 63 (yangi: format 5, Chat 8 — menyu/tahrir/o'chirish/xato/ulanish, ChatInfo 6 + yangi guruh/kanal 2,
  Sozlamalar 3 — tema saqlanishi, bildirishnoma). `react-native bundle` (android) lokal.
- **Tekshirilmadi:** haqiqiy telefon/emulyatorda ko'rinish va animatsiya, haptics, clipboard, iOS'da native build — faqat CI
  (android/ios job'lari). Skrinshot yo'q (sandboxda Android emulyator yo'q).
### v0.3.0 tayyorgarligi — release versiyasi va matni (2026-10-16)
- **Muammo (v0.2.0 release'ida):** desktop fayllari `suhbat-0.1.0-mac-arm64.dmg` va h.k. (versiya `apps/desktop/package.json`
  dan, u 0.1.0 edi); release matni faqat o'rnatish eslatmalari — `CHANGELOG.md` da `## v0.2.0` bo'limi yo'q edi
  ("Chiqarilmagan (v0.1.2)" deb nomlangan), va release oldindan mavjud bo'lsa matn umuman yangilanmasdi.
- **Tuzatish:** `scripts/release-version.sh <teg>` — desktop va android job'larida build'dan oldin web/desktop/mobile
  `package.json` versiyasi tegdan (faqat `version` maydoni). `scripts/release-notes.sh <teg>` — `## <teg>` bo'limini chiqaradi,
  yo'q/bo'sh bo'lsa yiqiladi; release `check` job'i shu bilan boshlanadi; mavjud release'ga `gh release edit --notes-file`.
  Repodagi versiyalar 0.2.0 ga ko'tarildi. `CHANGELOG.md`: `## v0.2.0` (qo'ng'iroqlar, global qidiruv, profil, o'zbekcha UI)
  va `## v0.3.0 (chiqarilmagan)`. CI `check` skriptlarni sinaydi.
- **Tekshirildi:** skriptlar lokal (to'g'ri/noto'g'ri teg, bo'limsiz teg). **Tekshirilmadi:** haqiqiy `v*` teg bilan release
  (macOS/Windows job'ida `bash` + `node -e`) — keyingi teg'da ko'rinadi. v0.2.0 dagi mavjud fayllar qayta nomlanmadi
  (egasi xohlasa Release workflow'ni `v0.2.0` bilan qo'lda qayta ishga tushirishi mumkin — lekin u `main` ni quradi).
### GitHub Actions sarfini kamaytirish (2026-10-16)
- **Sabab:** 16-oktabr ~10:42 dan Actions daqiqalari tugadi — barcha job'lar runner ajratilmasdan (2–3 s, logsiz) yiqila boshladi.
- **iOS** (`macos-15`, Linux'dan ~10× qimmat) alohida `mobile-ios.yml` ga ko'chirildi: faqat `apps/mobile/ios/**`,
  `apps/mobile/package.json` (native bog'liqliklar), `apps/mobile/Gemfile` yoki workflow fayli o'zgarganda + qo'lda
  (Actions → Mobile iOS → Run workflow). Debug simulyator build JS bundle'siz — JS/TS o'zgarishlari unga ta'sir qilmaydi.
- **Android** (`mobile.yml`): o'sha path'lar, lekin `apps/mobile/ios/**`, testlar (`*.test.ts(x)`, `__tests__`) va `*.md` hisobga
  olinmaydi; `workflow_dispatch` qo'shildi; `concurrency: cancel-in-progress` avvaldan bor edi.
- **CI** (`ci.yml`): faqat hujjat (`**/*.md`, `docs/**`) o'zgargan push/PR'da ishlamaydi; PR'da bir branch'ga yangi push eski
  run'ni bekor qiladi (`concurrency`, `main`da bekor qilinmaydi); `workflow_dispatch`.
- **E'tibor:** agar branch protection'da `ios` (yoki boshqa) check "required" bo'lsa, path filtri tufayli ishlamagan check PR'ni
  "kutilmoqda"da qoldiradi — required ro'yxatini moslash kerak (egasi, Settings → Branches). Release'dan oldin iOS build'ni
  qo'lda ishga tushirish tavsiya etiladi.
- **Tekshirilmadi:** Actions daqiqalari tiklanmaguncha workflow'lar ishlamaydi; YAML sintaksisi lokal tekshirildi.

### Kamchiliklar auditi — veb va desktop (2026-10-16)
- **Qanday tekshirildi:** jonli sayt (Railway) Playwright/Chromium bilan, 390 px (telefon) va 1280 px, yorug'/qorong'i;
  ikki test hisob ochildi (`claude-audit-a-65329334@example.com`, `claude-audit-b-…`, ism "Audit a/b 65329334") va
  ular orasida sinov xabarlari yuborildi. Tuzatishlar lokal API (Postgres 16) + `vite preview` bilan qayta ko'rildi.
- **Topildi va tuzatildi (veb):** bo'sh chatda composer ekran o'rtasida "suzib" turardi (bo'sh/yuklanish/xato holati maydonni
  to'ldirmasdi); oflayn/qayta ulanish holati umuman ko'rsatilmasdi → "Internet yo'q" / "Ulanmoqda…" yorlig'i (1,5 s kechikish bilan);
  yuborilmagan xabarda faqat "!" → "Yuborilmadi" + "Qayta yuborish" / "O'chirish"; havolalar bosilmasdi → faqat http(s) havolalar
  (`noopener noreferrer`, Electron'da tizim brauzerida); begona xabarni nusxalab bo'lmasdi → "Nusxa olish" menyusi; 1:1 chatda
  har xabar ustida suhbatdosh ismi va avatari (guruh uslubi) → faqat guruhda; OS qorong'i rejimi e'tiborsiz edi → tanlov yo'q bo'lsa
  tizimga ergashadi (`localStorage` yopiq bo'lsa ham yiqilmaydi, yaroqsiz qiymat e'tiborsiz); tab "Xabarlar" / sarlavha "Suhbatlar"
  nomuvofiq → "Suhbatlar"; "Chiqish" tugmasi tasdiqsiz edi → tasdiq oynasi; xabar/suhbat yuklash xatosida server/brauzerning xom
  matni (masalan, inglizcha) chiqishi mumkin edi → `errorText` (o'zbekcha zaxira matn); crash ekranida xom `error.message` → faqat
  dev rejimda; sahifa sarlavhasi "suhbat" → "Suhbat".
- **Topildi va tuzatildi (desktop):** Electron standart menyusi inglizcha (File/Edit/View/Window/Help, "Toggle Developer Tools") →
  o'zbekcha menyu (`src/main/menu.ts`; macOS'da Cmd+C/V uchun "Tahrirlash" role'lari; dasturchi vositalari faqat dev'da);
  oyna sarlavhasi "Suhbat"; yuklanguncha oq fon "miltillashi" → `backgroundColor` rejimga mos.
- **Mobil:** shu turdagi kamchiliklar (ulanish holati, bo'sh/xato holatlari, accessibility label'lari, uzun matn) — dizayn PR'ida.
- **Topildi, tuzatilmadi:** kirish sahifasida "or" (inglizcha) — login/register ekranlari parallel auth ishchisining sohasi.
  `UploadUrlInputSchema` da fayl nomi 255 belgidan uzun bo'lsa zod'ning inglizcha xabari chiqishi mumkin (kam uchraydi).
- **Testlar:** veb 85 (yangi: linkify 3, MessageBubble 4, ConnectionBanner 3, themeSlice 2), desktop 12 (yangi: menyu 2).
- **Tekshirilmadi:** haqiqiy telefon brauzeri (faqat Chromium emulyatsiyasi), Electron oynasida menyu (faqat unit), Safari/Firefox.

### v0.1.2 — egasining veb sinovidan keyingi tuzatishlar (2026-10-14)
Egasi veb versiyani telefonda ikki hisob bilan sinadi; topilgan 7 ta bug:
1. **Global qidiruv** (asosiy bug). Qidiruv faqat mavjud suhbatlarni filtrlardi. Endi (veb + desktop + mobil) bitta
   qidiruv maydoni "Qidirish": bo'limlar **Suhbatlar** (mavjud, nom bo'yicha), **Foydalanuvchilar** (`GET /users/search`),
   **Ochiq kanallar** (`GET /chats/public`). Debounce 300 ms, yuklanish ko'rsatkichi, har bo'lim uchun alohida xato +
   "Qayta urinish" (bittasi yiqilsa ikkinchisi ko'rinadi), eskirgan javoblar tashlanadi. Foydalanuvchi → `POST /chats/direct`
   (idempotent) va chat ochiladi; kanal → ko'rinish oynasi (nom, tavsif, obunachilar) va "Obuna bo'lish"/"Ochish"
   (mobilda `Alert` tasdig'i). Hook: `apps/web/src/hooks/useGlobalSearch.ts`, `apps/mobile/src/hooks/useGlobalSearch.ts`.
   Eski "Yangi suhbat" va "Ochiq kanallarni qidirish" dialoglari qoldi.
2. **Kanal ma'lumotida rollar.** Sabab (API emas, UI): kanal API'si `members`da owner/adminlar **va so'rayotgan foydalanuvchining
   o'zini** (rol `member`) qaytaradi — `myRole` shunga tayanadi (kontrakt, e2e'da bor). UI esa `participantDetails`ning hammasini
   "Ega va adminlar"da ko'rsatardi, shuning uchun oddiy obunachi ("Owner" ismli) o'zini shu ro'yxatda ko'rardi.
   Tuzatish: `utils/members.ts` — `listedMembers` (kanalda faqat owner/admin; guruhda hamma) va `subscriberCount`
   (= `memberCount` − ega/adminlar); obunachilar soni chat sarlavhasi, ro'yxat va info oynasida alohida. API o'zgarmadi.
3. **Sozlamalar:** "React · NestJS · Socket.IO" olib tashlandi → "Suhbat v{versiya}" (vite `define` `__APP_VERSION__`,
   `apps/web/package.json` dan). Butun veb UI o'zbekchalashtirildi (Sozlamalar, Profil, Ko'rinish, Yorug'/Qorong'i,
   onlayn/oflayn va "bugun 14:20 da bo'lgan", kirish/ro'yxatdan o'tish formasi, validatsiya, 404, xato ekranlari, aria-label'lar).
4. **Profil tahriri:** `User.bio` (migratsiya `*_user_bio`, `PublicUser.bio` nullable), `PATCH /users/me`
   `{ displayName?, bio? }` (trim; ism 1–64; bio ≤ 200, bo'sh/`null` — o'chiradi; kamida bitta maydon; zod `UpdateProfileInputSchema`),
   javob — `User`. Veb Sozlamalar paneli va mobil `ProfileScreen` ("Profil" tugmasi ro'yxat sarlavhasida).
   **Avatar yuklash — keyinga qoldirildi** (S3 hali sozlanmagan).
5. **Vaqt/sana:** 24 soatlik "14:20", "Kecha", hafta kuni o'zbekcha (`date-fns/locale/uz`), eski sana "05.01.2026".
   (Mobil `formatTime` avvaldan 24 soatlik edi.)
6. **Mobil brauzer joylashuvi:** `<md` ekranda drawer (+ kulrang backdrop chizig'i) olib tashlandi — ro'yxat to'liq kenglikda
   alohida ko'rinish, chat ochilganda ro'yxat yashiriladi, sarlavhada "Orqaga" (brauzer tarixi bo'yicha), pastda
   "Xabarlar / Sozlamalar" navigatsiyasi; balandlik `100dvh`. `AppShell` `mobileView: 'list' | 'chat'` oladi, `uiSlice.sidebarOpen` olib tashlandi.
7. **Kanal info "Qo'shish" tugmasi:** tanlangan qator to'q rangda belgilanadi + belgi (checkbox, `role="checkbox"`
   `aria-checked`), tugma tanlangach `contained` va "Qo'shish (N)". Eslatma: jsdom'da eski kodda ham tugma tanlashdan keyin
   faollashardi — telefondagi "kulrang" holatni aynan qayta ko'ra olmadim; sabab ehtimol faqat ko'rinishda (tanlov deyarli
   sezilmasdi, tugma `outlined` edi). Ko'rinish tuzatildi, holat testlari qo'shildi.
- **Testlar:** web 73 (yangi: ChatList qidiruv 8, ChatInfoDialog 4, SettingsPanel 3, AppShell 3, ChatHeader 2, members 4,
  formatters), core 44, mobil 39 (yangi `SearchProfile.test.tsx` 8), API e2e 34 (yangi: kanal rollari, `PATCH /users/me`).
  `turbo run lint typecheck test` yashil. Haqiqiy Chromium (Playwright, 390×780, lokal API + `vite preview`): ro'yxat 390 px
  (gorizontal skroll yo'q), qidiruv bo'limlari, kanalga obuna, chat to'liq ekran, "Orqaga", sozlamalarda texnologiya yozuvi yo'q, profil saqlandi.
- **Tekshirilmadi:** haqiqiy telefon brauzeri (iOS Safari/Android Chrome) — faqat Chromium emulyatsiyasi; Railway deploy;
  desktop (Electron) oynasida qo'lda; mobil ilova qurilmada (faqat jest). Ism o'zgarishi boshqalarga real vaqtda yetmaydi.

### Auth: username va parolni tiklash (2026-10-16)
Sabab: egasi hisobiga kira olmadi ("Email yoki parol noto'g'ri") va "Parolni unutdim" yo'q edi.
Aniq sabab (noto'g'ri parolmi, boshqa email bilan ochilgan hisobmi) koddan ko'rinmaydi — endi parolni o'zi tiklay oladi.
- **Username** (`User.username`, migratsiya `*_username_password_reset`): ixtiyoriy (mavjud hisoblarda `null`),
  5–32 belgi, `a-z0-9_`, harf bilan boshlanadi, `_` bilan tugamaydi, `__` yo'q; zaxira so'zlar (admin, support,
  suhbat*, …) — `@suhbat/core` `username.ts` (`usernameProblem`, `UsernameSchema`, `RESERVED_USERNAMES`).
  Doim kichik harfda saqlanadi (`CHECK username = lower(username)`) → oddiy unique = katta-kichik harf farqsiz unique.
  Ro'yxatdan o'tishda ixtiyoriy maydon; `GET /users/username-available?u=` (tokensiz; usernamelar ochiq ma'lumot,
  email uchun bunday tekshiruv yo'q); profilda o'zgartirish/o'chirish (`PATCH /users/me { username }`, band — 409).
  `PublicUser.username` (eski server javobida bo'lmasa `null`). Qidiruv: username — aniq moslik (`@` bilan boshlansa
  faqat username), aniq moslik ro'yxatda birinchi.
- **Kirish:** `POST /auth/login { login, password }` — `login` email (ichida `@`) yoki username (boshidagi `@` tashlanadi).
  Eski mijozlar (v0.2.0 APK) yuboradigan `{ email }` ham qabul qilinadi. Xato matni: "Login yoki parol noto'g'ri".
- **Parolni tiklash** (`PasswordResetService`): `POST /auth/forgot-password { emailOrUsername }` — javob **doim bir xil**
  (200 + bir xil matn), xat fonda yuboriladi (javob vaqti xatga bog'liq emas). Token: 32 bayt (`base64url`), bazada faqat
  sha256 (`PasswordResetToken`), 30 daqiqa, bir martalik (shartli `updateMany` — parallel so'rovdan bittasi o'tadi);
  yangisi so'ralganda eskilari bekor. `POST /auth/reset-password { token, newPassword }` → 204: parol yangilanadi,
  boshqa tiklash tokenlari va **foydalanuvchining barcha refresh token oilalari bekor** (bitta tranzaksiyada).
  Cheklovlar: `@AuthThrottle` (10/daqiqa, IP+endpoint) + IP bo'yicha 5 / 15 daqiqa (429, `FORGOT_PASSWORD_IP_*`,
  xotirada) + hisob bo'yicha 3 / soat (bazadagi tokenlar soni; oshsa — xat jim yuborilmaydi, javob o'zgarmaydi).
- **Email:** `Mailer` abstraktsiyasi (`src/mail`): `ResendMailer` (HTTP API, `RESEND_API_KEY`), `SmtpMailer`
  (nodemailer, `SMTP_URL`), `DisabledMailer`. `MAIL_FROM` shart; `WEB_URL` — havola `${WEB_URL}/reset-password?token=…`.
  Kalit/`MAIL_FROM`/`WEB_URL` bo'lmasa API ko'tariladi, logda ogohlantirish, forgot-password — bor/yo'q hisob uchun
  bir xil 503 "Email yuborish hozircha sozlanmagan". Xat o'zbekcha, HTML (ism ekranlanadi) + matn.
  Egasi qadamlari: `QADAMLAR.md` 14 (Resend akkaunt, domen yoki `onboarding@resend.dev`, Railway Variables).
- **Veb/desktop:** login maydoni "Email yoki username", "Parolni unutdim?" → `/forgot-password`, `/reset-password`
  (yangi parol + tasdiqlash, kuch ko'rsatkichi; token darhol URL'dan olib tashlanadi — `navigate(replace)` =
  `history.replaceState`; kirgan bo'lsa shu brauzerdan ham chiqadi). Ro'yxatdan o'tishda username (jonli tekshiruv:
  format — darhol, bandlik — 400 ms debounce). Sozlamalarda username. Qidiruv natijasida `@username`.
  Desktop — veb bilan bir xil kod (so'rov sahifasi ilova ichida); **xatdagi havola tizim brauzerida vebda ochiladi**,
  `suhbat://reset-password` deep link — **qilinmadi (keyin)**.
- **Mobil:** login'da "Email yoki username", "Parolni unutdim?" → so'rov ekrani (kiritilgan qiymat ko'chadi, Android
  "orqaga"), ro'yxatdan o'tish va Profil'da username (jonli tekshiruv). Xatdagi havola **vebda** ochiladi; mobil deep link
  (`suhbat://` / App Links) — **keyin**. Mobil ekranlarga faqat auth/profil/qidiruv qatoriga (`@username`) tegildi.
- **Testlar:** core 63 (username qoidalari, login/register/profil sxemalari), client 42, api unit 92 (mailer: Resend so'rovi,
  xato matnida kalit yo'q, tanlov; PasswordResetService: 503, hash, TTL, eski tokenlar, jim holatlar, IP limiti, reset
  tranzaksiyasi, parallel), API e2e 47 (yangi `auth-reset.e2e-spec.ts` 13: username unique/case-insensitive + CHECK,
  format/zaxira, availability, login email/username/eski `email`, qidiruv, profil 409; forgot doim bir xil (bor/yo'q,
  email/username), faqat hash, reset → eski parol rad, token qayta — 400, ikki qurilma refresh — 401, yangi so'rov eskisini
  bekor qiladi, muddati o'tgan, IP 429 + hisob limiti, sozlanmagan — bir xil 503), web 94 (`AuthPages.test.tsx` 12,
  SettingsPanel username, passwordStrength), mobil 44 (`AuthFlow.test.tsx` 5). `turbo run lint typecheck test build` yashil.
  **Brauzerda (Playwright, Chromium 390 px, lokal API + `vite preview`, API `SMTP_URL` → lokal SMTP "sink"):**
  ro'yxatdan o'tish username bilan → "Parolni unutdim?" (`@username`) → **haqiqiy SMTP xati** (nodemailer) keldi →
  havola ochildi, URL'da token qolmadi → yangi parol → eski havola yaroqsiz → eski parol rad, username + yangi parol
  bilan kirildi → boshqa kontekstdagi eski sessiya yangilanganda `/login` ga tushdi.
- **Tekshirilmagan:** **haqiqiy Resend API** (faqat soxta `fetch` bilan unit) va haqiqiy pochta yetkazilishi (spam va h.k.);
  Railway'da deploy; mobil ilovada qurilmada (faqat jest); desktop oynasida qo'lda.
- **Cheklovlar / keyin:**
  - **Email tasdiqlash — keyin** (hozir ro'yxatdan o'tishda email tekshirilmaydi; boshqaning emaili bilan hisob ochish
    mumkin, tiklash xati esa email egasiga boradi).
  - Parol tiklangach **access token'lar (≤ 15 daqiqa) va ochiq socket'lar** o'z muddatigacha ishlaydi — refresh bekor
    bo'lgani uchun keyingi yangilashda chiqadi; darhol uzish (token versiyasi / `passwordChangedAt`) — keyin.
  - IP limiti bitta API nusxasi xotirasida (ko'p nusxa — Redis). `TRUST_PROXY` bo'lmasa hamma bitta IP.
  - Login'da hisob yo'q bo'lsa argon2 tekshiruvi qilinmaydi — javob vaqti bo'yicha hisob borligini taxmin qilish
    nazariy jihatdan mumkin (oldin ham shunday edi).
  - Username tarixi/qayta band qilishdan himoya yo'q (bo'shatilgan username'ni darhol boshqa odam olishi mumkin).
  - Deep link (desktop `suhbat://reset-password`, mobil App Links/Universal Links) — keyin.

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
  desktop ↔ jonli API (CORS `suhbat://app`), ikonkalar (v0.1.1 da qo'shildi), MinIO bilan
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
- **4a (push) — PR ko'rib chiqishda (2026-10-13):** API + mobil (FCM HTTP v1, iOS ham FCM orqali),
  preview sozlamasi, bloklash. Qurilmada sinalmagan; Web Push — keyin. Yuqorida "4-faza".
- **4b (1:1 qo'ng'iroqlar) — PR #11 ko'rib chiqishda (2026-10-14):** signal (Socket.IO), ICE/TURN env,
  `CallSession`, veb/desktop va mobil UI. Qurilmada va NAT/TURN orqali sinalmagan. Yuqorida "4b-faza".

## Keyingi sessiya uchun
4b (qo'ng'iroqlar) PR #11 da. Merge'dan keyin taklif etiladigan navbat:
1. **Egasi:** TURN tanlash va sozlash (`QADAMLAR.md` 13) — busiz mobil internet/NAT ortida qo'ng'iroq
   ulanmasligi mumkin. Keyin ikki xil tarmoqda va haqiqiy telefonda sinash.
2. **4c (qo'ng'iroq sifati):** jiringlash ovozi (veb + mobil), karnay/quloqchin (`react-native-incall-manager`),
   CallKit / ConnectionService (qulflangan ekranda jiringlash, data-only push), socket qisqa uzilganda va
   tarmoq almashganda qo'ng'iroqni tiklash (ICE restart + `call:resume`).
3. Mobil 3b qoldiqlari: CI'da Android emulyator smoke testi, media yuborish, tahrirlash/o'chirish UI.
4. Redis (registr, presence, rate limit — ko'p API nusxasi).

### Deploy'dan keyingi navbat (tekshiruvchi tartibi, 2026-10-13)
1. **4-faza:** push — PR'da (qolgan: egasi Firebase'ni sozlaydi — `QADAMLAR.md` 12; `release.yml` ga
   `GOOGLE_SERVICES_JSON` env'ini qo'shish; haqiqiy qurilmada sinash; mobil/veb bloklash UI va preview
   sozlamasi UI; Web Push). 4b qo'ng'iroqlar — PR #11.
2. **Mobil:** media yuborish, xabarni tahrirlash/o'chirish, guruh boshqaruvi + haqiqiy qurilmada sinov.
3. **Do'konlar:** Play Store uchun doimiy keystore; iOS release / App Store.
4. **Desktop:** ikonkalar, kod imzosi (Apple/Windows), avto-yangilanish.
5. **Redis:** ko'p API nusxasi, presence va rate limit.
6. **Profil avatari** (S3 sozlangach), veb code-splitting.

Boshqa ixtiyoriy: egalikni o'tkazish, kanal ban ro'yxati.
