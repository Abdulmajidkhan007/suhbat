# suhbat

O'zbek messenjeri — veb, desktop, Android, iOS. Reja va holat: [`docs/REJA.md`](docs/REJA.md).

## Tuzilish

```
apps/
  api/      NestJS 11 + Prisma 7 + PostgreSQL — REST + Socket.IO
  web/      React 19 + Vite — o'z API'mizga ulangan (Firebase yo'q)
packages/
  core/     zod sxemalar, WebSocket event tiplari, umumiy yordamchilar
  client/   API + WebSocket mijozi (web, desktop, mobile umumiy)
```

## Ishga tushirish

Talab: Node 22+, Docker.

```bash
npm install                          # apps/api uchun Prisma client ham yaratiladi
npm run db:up                        # Postgres (docker compose)

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
npm run db:deploy -w @suhbat/api && npm run test:e2e -w @suhbat/api   # Postgres kerak
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
| GET   | `/users/search?q=&limit=` | ism/email bo'yicha (o'zini qaytarmaydi)              |
| GET   | `/chats`               | chatlar: a'zolar, oxirgi xabar, `unreadCount`           |
| POST  | `/chats/direct`        | `{ userId }` → 1:1 chat (bor bo'lsa — o'sha)            |
| GET   | `/chats/:id`           | bitta chat                                              |
| GET   | `/chats/:id/messages?before=&limit=` | tarix (keyset): `{ items, nextCursor }`   |
| POST  | `/chats/:id/messages`  | `{ content, clientId? }` — REST zaxira (asosiysi WS)    |

### WebSocket (Socket.IO)

Ulanish: `io(API_URL, { auth: { token: accessToken } })`. Tiplar — `@suhbat/core` (`ws.ts`).

| Yo'nalish | Event             | Payload                                  |
|-----------|-------------------|------------------------------------------|
| → server  | `message:send`    | `{ chatId, content, clientId? }` → ack `{ ok, data: Message }` |
| → server  | `typing`          | `{ chatId, isTyping }`                   |
| → server  | `message:read`    | `{ chatId, messageId }` → ack `{ ok, data: { lastReadAt } }` |
| ← mijoz   | `message:new`     | `{ message, clientId? }`                 |
| ← mijoz   | `typing`          | `{ chatId, userId, isTyping }`           |
| ← mijoz   | `message:read`    | `{ chatId, userId, lastReadAt }`         |
| ← mijoz   | `presence:state`  | `{ online: userId[] }` (ulanganda)       |
| ← mijoz   | `presence:update` | `{ userId, online, lastSeenAt }`         |
