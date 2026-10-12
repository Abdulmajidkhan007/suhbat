# suhbat

O'zbek messenjeri — veb, desktop, Android, iOS. Reja va holat: [`docs/REJA.md`](docs/REJA.md).

## Tuzilish

```
apps/
  api/      NestJS 11 + Prisma 7 + PostgreSQL — REST + Socket.IO
  web/      React 19 + Vite — o'z API'mizga ulangan (Firebase yo'q)
  desktop/  Electron — veb build'ini o'raydi (macOS dmg, Windows nsis)
packages/
  core/     zod sxemalar, WebSocket event tiplari, umumiy yordamchilar
  client/   API + WebSocket mijozi (web, desktop, mobile umumiy)
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
| POST  | `/auth/register`       | `{ email, password, displayName }` → `{ accessToken, refreshToken, user }` |
| POST  | `/auth/login`          | `{ email, password }` → `{ accessToken, refreshToken, user }` |
| POST  | `/auth/refresh`        | `{ refreshToken }` → yangi `{ accessToken, refreshToken }` |
| POST  | `/auth/logout`         | `{ refreshToken }` → 204 (shu sessiya yopiladi)         |
| GET   | `/auth/me`             | joriy foydalanuvchi                                     |
| GET   | `/users/search?q=&limit=` | ism (qism) yoki email (faqat to'liq mos) bo'yicha; o'zini qaytarmaydi |
| GET   | `/chats`               | chatlar: a'zolar, oxirgi xabar, `unreadCount`           |
| POST  | `/chats/direct`        | `{ userId }` → 1:1 chat (bor bo'lsa — o'sha)            |
| GET   | `/chats/:id`           | bitta chat                                              |
| GET   | `/chats/:id/messages?before=&limit=` | tarix (keyset): `{ items, nextCursor }`   |
| POST  | `/chats/:id/messages`  | `{ content, attachmentId?, clientId? }` — REST zaxira (asosiysi WS) |
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
| POST  | `/media/upload-url`    | `{ chatId, kind, name, mime, size, durationMs? }` → `{ attachmentId, uploadUrl, headers }` |

Kanalda faqat owner/admin yozadi. Media: `upload-url` → mijoz faylni `uploadUrl` ga
`PUT` qiladi (API orqali oqim o'tmaydi) → xabarda `attachmentId`. Cheklovlar
(`@suhbat/core` → `ATTACHMENT_RULES`): rasm ≤ 10 MB (jpeg/png/webp/gif), ovoz ≤ 10 MB
va ≤ 5 daqiqa, fayl ≤ 25 MB (ruxsat etilgan MIME ro'yxati; SVG/HTML/bajariladigan fayllar yo'q).

### WebSocket (Socket.IO)

Ulanish: `io(API_URL, { auth: { token: accessToken } })`. Tiplar — `@suhbat/core` (`ws.ts`).

| Yo'nalish | Event             | Payload                                  |
|-----------|-------------------|------------------------------------------|
| → server  | `message:send`    | `{ chatId, content, attachmentId?, clientId? }` → ack `{ ok, data: Message }` |
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
yangilab qayta ulanadi.

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
Release: `v*` tegi push qilinsa `release-desktop.yml` macOS/Windows build'ini
GitHub Release'ga yuklaydi (repo o'zgaruvchisi `SUHBAT_API_URL` kerak). Artefaktlar **imzosiz**.
