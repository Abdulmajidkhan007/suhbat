# Ishlab chiqish (development)

Loyiha tuzilishi, lokal ishga tushirish, tekshiruvlar, desktop va mobil build. API kontrakti —
[`API.md`](API.md); deploy — [`DEPLOY.md`](DEPLOY.md) va [`../QADAMLAR.md`](../QADAMLAR.md); reja va holat —
[`REJA.md`](REJA.md).

## Tuzilish

```
apps/
  api/      NestJS 11 + Prisma 7 + PostgreSQL — REST + Socket.IO
  web/      React 19 + Vite — o'z API'mizga ulangan (Firebase yo'q)
  desktop/  Electron — veb build'ini o'raydi (macOS dmg, Windows nsis)
  mobile/   bare React Native CLI 0.87 (Android, iOS)
packages/
  core/     zod sxemalar, WebSocket event tiplari, umumiy yordamchilar
  client/   API + WebSocket mijozi (web, desktop, mobile umumiy)
  ui-tokens/ ranglar, o'lchamlar (veb MUI va mobil uchun umumiy)
```

## Ishga tushirish

Talab: Node 22+, Docker.

```bash
npm install                          # apps/api uchun Prisma client ham yaratiladi
npm run db:up                        # Postgres + MinIO (docker compose)

cp apps/api/.env.example apps/api/.env
npm run db:migrate -w @suhbat/api    # migratsiyalar
cp apps/web/.env.example apps/web/.env   # VITE_API_URL=http://localhost:4000

npx turbo run dev                    # core/client build, API :4000, veb :3000
```

`@suhbat/core` va `@suhbat/client` avval build qilinishi kerak
(`npx turbo run build --filter=@suhbat/client`); `npx turbo run dev` buni o'zi qiladi.

## Tekshiruvlar

```bash
npx turbo run lint typecheck test build
npm run db:deploy -w @suhbat/api && npm run test:e2e -w @suhbat/api   # Postgres + MinIO kerak
```

## Muhit o'zgaruvchilari (env)

Namunalar repoda: [`apps/api/.env.example`](../apps/api/.env.example) va
[`apps/web/.env.example`](../apps/web/.env.example). Haqiqiy kalitlar, tokenlar va `.env` fayllar repoga qo'shilmaydi.

- **API (majburiy):** `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (vergul bilan; desktop uchun `suhbat://app`).
- **API (ixtiyoriy):** media — `S3_*`; push — `FCM_SERVICE_ACCOUNT_JSON`; qo'ng'iroq — `STUN_URLS`, `TURN_*`;
  parolni tiklash xati — `RESEND_API_KEY` yoki `SMTP_URL`, `MAIL_FROM`, `WEB_URL`; cheklovlar — `THROTTLE_*`, `WS_SEND_*`,
  `CALL_INVITE_*`, `FORGOT_PASSWORD_*`; proksi ortida — `TRUST_PROXY`.
- **Veb / desktop:** `VITE_API_URL` (build vaqtida qotadi).
- **Mobil:** `SUHBAT_API_URL` (bundle vaqtida qotadi).

## Desktop (Electron)

`apps/desktop` veb kodini import qilmaydi: `apps/web/dist` ni `suhbat://app`
maxsus sxemasi orqali yuklaydi. API manzili **veb build vaqtida** (`VITE_API_URL`)
qotiriladi; API'da `CORS_ORIGIN` ga `suhbat://app` qo'shilishi kerak.

```bash
VITE_API_URL=http://localhost:4000 npx turbo run build --filter=@suhbat/desktop
npm run dev -w @suhbat/desktop            # build + Electron oynasi
npm run package:dir -w @suhbat/desktop    # qadoqlangan (unpacked) ilova, joriy OS uchun
npm run package -w @suhbat/desktop -- --mac   # dmg (faqat macOS'da)
npm run package -w @suhbat/desktop -- --win   # nsis (Windows'da)
```

Dev: `SUHBAT_DEV_URL=http://localhost:3000 npm run dev -w @suhbat/desktop` (Vite serveriga ulanadi).
Release: `v*` tegi push qilinsa `release.yml` (desktop + Android APK) build qiladi va
GitHub Release'ga yuklaydi (repo o'zgaruvchisi `SUHBAT_API_URL` kerak). Desktop artefaktlari **imzosiz**; Android APK imzosi — [`DEPLOY.md`](DEPLOY.md).

## Mobil (React Native CLI)

`apps/mobile` — bare React Native CLI (Expo emas). Talablar: Android Studio + JDK 17
(Android), Xcode + CocoaPods (iOS, faqat macOS).

```bash
npx turbo run build --filter=@suhbat/mobile^...   # core, client, ui-tokens dist
npm run start -w @suhbat/mobile                    # Metro
npm run android -w @suhbat/mobile                  # emulyator/qurilma
cd apps/mobile/ios && bundle install && bundle exec pod install && cd - && npm run ios -w @suhbat/mobile
```

API manzili build (bundle) vaqtida qotadi: `SUHBAT_API_URL=https://api.example.uz`.
O'rnatilmasa — Android emulyatorda `http://10.0.2.2:4000`, iOS simulyatorda
`http://localhost:4000`. Qiymat o'zgarsa Metro keshi o'zi yangilanadi (`cacheVersion`).
Haqiqiy qurilmada kompyuterning LAN IP'sini bering (`http://192.168.x.x:4000`).
Android: HTTP faqat debug build'da (release'da cleartext o'chiq). iOS: shablon ATS sozlamasi
(`NSAllowsLocalNetworking`), ishlab chiqarishda faqat HTTPS.

Push bildirishnomalar (FCM) uchun Firebase fayllari kerak — [`apps/mobile/README.md`](../apps/mobile/README.md).
Ularsiz ilova push'siz ishlaydi.

Native'siz tekshiruv: `npm run lint|typecheck|test -w @suhbat/mobile`,
`npm run bundle:android -w @suhbat/mobile`. Native build — [`.github/workflows/mobile.yml`](../.github/workflows/mobile.yml)
(Android debug + imzosiz release APK) va [`mobile-ios.yml`](../.github/workflows/mobile-ios.yml) (iOS simulyator; faqat iOS/native bog'liqliklar
o'zgarganda yoki qo'lda — macOS runner qimmat).
