# suhbat

O'zbek messenjeri — veb, desktop, Android, iOS. Reja va holat: [`docs/REJA.md`](docs/REJA.md). Joylash (Railway) — [`QADAMLAR.md`](QADAMLAR.md).

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

## API

Auth: `Authorization: Bearer <accessToken>`. Access token qisqa (`JWT_EXPIRES_IN`,
standart 15m); refresh token — body'da, bir martalik (rotatsiya).

| Metod | Yo'l                   | Izoh                                                    |
|-------|------------------------|---------------------------------------------------------|
| GET   | `/health`              | API va DB holati                                        |
| POST  | `/auth/register`       | `{ email, password, displayName, username? }` → `{ accessToken, refreshToken, user }`; 409 — email yoki username band |
| POST  | `/auth/login`          | `{ login, password }` (`login` — email yoki username, `@` bilan ham; eski `{ email }` ham qabul qilinadi) → `{ accessToken, refreshToken, user }` |
| POST  | `/auth/forgot-password` | `{ emailOrUsername }` → 200 doim bir xil `{ message }` (hisob borligi oshkor qilinmaydi); 503 — email sozlanmagan; 429 — IP limiti |
| POST  | `/auth/reset-password` | `{ token, newPassword }` → 204; token bir martalik, 30 daqiqa; **barcha sessiyalar** (refresh token oilalari) bekor; 400 — yaroqsiz/muddati o'tgan |
| POST  | `/auth/refresh`        | `{ refreshToken }` → yangi `{ accessToken, refreshToken }` |
| POST  | `/auth/logout`         | `{ refreshToken, deviceToken? }` → 204 (shu sessiya yopiladi; push tokeni ham o'chadi) |
| GET   | `/auth/me`             | joriy foydalanuvchi                                     |
| GET   | `/users/search?q=&limit=` | ism (qism), username (aniq; `@` bilan boshlansa faqat username) yoki email (faqat to'liq mos) bo'yicha; o'zini qaytarmaydi |
| GET   | `/users/username-available?u=` | **tokensiz**: `{ username, available, reason }` (format, zaxira so'z, band) |
| PATCH | `/users/me`               | `{ displayName?, bio?, username? }` — profil (javob `User`); bo'sh `bio`/`username` (yoki `null`) o'chiradi; 409 — username band |
| GET   | `/users/me/notifications` | `{ preview }` — push'da matn ko'rinadimi              |
| PATCH | `/users/me/notifications` | `{ preview }` (`false` — faqat "Yangi xabar")         |
| POST  | `/users/:id/block`     | bloklash (idempotent): 1:1 da yozib bo'lmaydi, push bormaydi |
| DELETE| `/users/:id/block`     | blokdan chiqarish                                       |
| GET   | `/users/blocked`       | men bloklaganlar                                        |
| POST  | `/devices`             | `{ platform: 'android'\|'ios'\|'web', token }` — push tokeni (upsert) → 204 |
| DELETE| `/devices/:token`      | o'z push tokenini o'chirish → 204                       |
| GET   | `/chats`               | chatlar: a'zolar, oxirgi xabar, `unreadCount`           |
| POST  | `/chats/direct`        | `{ userId }` → 1:1 chat (bor bo'lsa — o'sha)            |
| GET   | `/chats/:id`           | bitta chat                                              |
| GET   | `/chats/:id/messages?before=&limit=` | tarix (keyset): `{ items, nextCursor }`   |
| POST  | `/chats/:id/messages`  | `{ content, attachmentId?, replyToId?, clientId? }` — REST zaxira (asosiysi WS); `replyToId` — shu chatdagi tirik xabar, aks holda 400 |
| PATCH | `/chats/:id/messages/:mid` | `{ content }` — faqat muallif, faqat matn            |
| DELETE| `/chats/:id/messages/:mid` | soft-delete: muallif yoki guruh/kanal owner/admini   |
| POST  | `/chats/group`         | `{ title, description?, memberIds }` → guruh (yaratuvchi — owner) |
| POST  | `/chats/channel`       | `{ title, description?, isPublic }` → kanal             |
| GET   | `/chats/public?q=&limit=` | ochiq kanallar qidiruvi (`isMember`, `memberCount`)  |
| PATCH | `/chats/:id`           | `{ title?, description?, isPublic? }` — owner/admin     |
| DELETE| `/chats/:id`           | guruh/kanalni o'chirish — faqat owner                   |
| POST  | `/chats/:id/join`      | ochiq kanalga obuna (idempotent)                        |
| POST  | `/chats/:id/leave`     | chiqish (owner chiqa olmaydi)                           |
| POST  | `/chats/:id/members`   | `{ userIds }` — owner/admin; guruhda ≤ 200 a'zo         |
| DELETE| `/chats/:id/members/:uid` | a'zoni chiqarish (admin faqat oddiy a'zoni)          |
| PATCH | `/chats/:id/members/:uid` | `{ role: 'admin' \| 'member' }` — faqat owner          |
| GET   | `/calls/ice-servers`   | qo'ng'iroq uchun `{ iceServers, ttlSeconds }` — STUN + (sozlangan bo'lsa) TURN |
| POST  | `/media/upload-url`    | `{ chatId, kind, name, mime, size, durationMs? }` → `{ attachmentId, uploadUrl, headers }` |

Kanalda faqat owner/admin yozadi. Media: `upload-url` → mijoz faylni `uploadUrl` ga
`PUT` qiladi (API orqali oqim o'tmaydi) → xabarda `attachmentId`. Cheklovlar
(`@suhbat/core` → `ATTACHMENT_RULES`): rasm ≤ 10 MB (jpeg/png/webp/gif), ovoz ≤ 10 MB
va ≤ 5 daqiqa, fayl ≤ 25 MB (ruxsat etilgan MIME ro'yxati; SVG/HTML/bajariladigan fayllar yo'q).

### WebSocket (Socket.IO)

Ulanish: `io(API_URL, { auth: { token: accessToken } })`. Tiplar — `@suhbat/core` (`ws.ts`).

| Yo'nalish | Event             | Payload                                  |
|-----------|-------------------|------------------------------------------|
| → server  | `message:send`    | `{ chatId, content, attachmentId?, replyToId?, clientId? }` → ack `{ ok, data: Message }` (`Message.replyTo` — asl xabar ko'rinishi) |
| → server  | `typing`          | `{ chatId, isTyping }`                   |
| → server  | `message:read`    | `{ chatId, messageId }` → ack `{ ok, data: { lastReadAt } }` |
| → server  | `message:edit`    | `{ chatId, messageId, content }` → ack `{ ok, data: Message }` |
| → server  | `message:delete`  | `{ chatId, messageId }` → ack `{ ok, data: { deletedAt } }` |
| ← mijoz   | `message:new`     | `{ message, clientId? }`                 |
| ← mijoz   | `message:updated` | `{ message }` (tahrirlandi, `editedAt`)  |
| ← mijoz   | `message:deleted` | `{ chatId, messageId, deletedAt }`       |
| ← mijoz   | `chat:updated`    | `{ chatId, title, description, isPublic, updatedAt }` |
| ← mijoz   | `chat:member`     | `{ chatId, userId, action: added\|removed\|role, member, memberCount }` |
| ← mijoz   | `chat:deleted`    | `{ chatId }`                             |
| ← mijoz   | `typing`          | `{ chatId, userId, isTyping }`           |
| ← mijoz   | `message:read`    | `{ chatId, userId, lastReadAt }`         |
| ← mijoz   | `presence:state`  | `{ online: userId[] }` (ulanganda)       |
| ← mijoz   | `presence:update` | `{ userId, online, lastSeenAt }`         |

Access token tugaganda (`exp`) server socketni uzadi; `@suhbat/client` tokenni
yangilab qayta ulanadi (faol qo'ng'iroq signali o'tayotgan socket — qo'ng'iroq tugagach).

**Qo'ng'iroqlar (1:1, WebRTC)** — sxemalar `@suhbat/core` (`calls.ts`), mijoz mantiqi
`@suhbat/client` (`CallSession`, `createCallManager`). Media serverdan o'tmaydi.

| Yo'nalish | Event          | Payload |
|-----------|----------------|---------|
| → server  | `call:invite`  | `{ callId (mijoz UUID), chatId, media: audio\|video }` → ack `{ callId }` |
| → server  | `call:ringing` | `{ callId }` — qabul qiluvchi qurilmasi jiringlayapti |
| → server  | `call:accept` / `call:reject` / `call:cancel` / `call:end` | `{ callId }` → ack |
| ↔         | `call:offer` / `call:answer` | `{ callId, description: { type, sdp } }` (faqat qo'ng'iroqqa bog'langan ikki socket orasida) |
| ↔         | `call:ice`     | `{ callId, candidate \| null }` |
| ← mijoz   | `call:invite`  | `{ callId, chatId, media, from, createdAt }` (qabul qiluvchining hamma qurilmasiga; ulanganda qayta) |
| ← mijoz   | `call:ringing` / `call:accept` / `call:busy` | `{ callId }` (chaqiruvchiga) |
| ← mijoz   | `call:end`     | `{ callId, reason, durationMs }` — `hangup\|rejected\|cancelled\|missed\|busy\|disconnected\|answered_elsewhere` |

Faqat 1:1 chat a'zolari, bloklanmagan; bir vaqtda bitta qo'ng'iroq; 45 s javob bo'lmasa `missed`
(`CALL_RING_TIMEOUT_MS`). Tugaganda chatga tizim xabari (`type: system`): "📞 Qo'ng'iroq, 3:12",
"Javobsiz/Rad etilgan/Bekor qilingan qo'ng'iroq". Qabul qiluvchi oflayn bo'lsa — push (`data.type = call`).

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
GitHub Release'ga yuklaydi (repo o'zgaruvchisi `SUHBAT_API_URL` kerak). Desktop artefaktlari **imzosiz**; Android APK imzosi — `docs/DEPLOY.md`.

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

Push bildirishnomalar (FCM) uchun Firebase fayllari kerak — `apps/mobile/README.md`.
Ularsiz ilova push'siz ishlaydi.

Native'siz tekshiruv: `npm run lint|typecheck|test -w @suhbat/mobile`,
`npm run bundle:android -w @suhbat/mobile`. Native build — `.github/workflows/mobile.yml`
(Android debug + imzosiz release APK) va `mobile-ios.yml` (iOS simulyator; faqat iOS/native bog'liqliklar
o'zgarganda yoki qo'lda — macOS runner qimmat).
