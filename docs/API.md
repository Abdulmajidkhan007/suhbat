# Suhbat API

REST va WebSocket (Socket.IO) kontrakti. Sxemalar va tiplar — `packages/core` (`@suhbat/core`),
mijoz — `packages/client` (`@suhbat/client`). Ishga tushirish — [`DEVELOPMENT.md`](DEVELOPMENT.md).

## REST

Auth: `Authorization: Bearer <accessToken>`. Access token qisqa (`JWT_EXPIRES_IN`,
standart 15m); refresh token — body'da, bir martalik (rotatsiya).

| Metod | Yo'l                   | Izoh                                                    |
|-------|------------------------|---------------------------------------------------------|
| GET   | `/health`              | API va DB holati                                        |
| POST  | `/auth/register`       | `{ email, password, displayName, username? }` → `{ accessToken, refreshToken, user, recoveryCodes }` (10 ta tiklash kodi — faqat shu javobda); 409 — email yoki username band |
| POST  | `/auth/login`          | `{ login, password }` (`login` — email yoki username, `@` bilan ham; eski `{ email }` ham qabul qilinadi) → `{ accessToken, refreshToken, user }` |
| POST  | `/auth/forgot-password` | `{ emailOrUsername }` → 200 doim bir xil `{ message }` (hisob borligi oshkor qilinmaydi); 503 — email sozlanmagan; 429 — IP limiti |
| POST  | `/auth/reset-password` | `{ token, newPassword }` → 204; token bir martalik, 30 daqiqa; **barcha sessiyalar** (refresh token oilalari) bekor; 400 — yaroqsiz/muddati o'tgan |
| POST  | `/auth/recover` | Emailsiz tiklash: `{ login, code, newPassword }` → 204; kod bir martalik (shartli `updateMany`); **barcha sessiyalar** bekor. Har qanday xato — bir xil 400 `Login yoki tiklash kodi noto'g'ri` (hisob borligi oshkor qilinmaydi); 429 — IP (`RECOVER_IP_LIMIT`, 10/15 daq) yoki login (`RECOVER_ACCOUNT_LIMIT`, 5/soat, mavjud bo'lmagan login ham sanaladi) limiti |
| GET   | `/auth/recovery-codes` | JWT. `{ remaining, generatedAt }` — kodlarning o'zi qaytmaydi |
| POST  | `/auth/recovery-codes` | JWT. `{ password }` (joriy) → `{ codes: string[10] }`; eskilari o'chadi; 400 — parol noto'g'ri |
| POST  | `/auth/change-password` | JWT. `{ currentPassword, newPassword }` → `AuthResponse` (shu qurilmaga yangi tokenlar); boshqa barcha refresh tokenlar va email tiklash havolalari bekor; 400 — joriy parol noto'g'ri |
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

## WebSocket (Socket.IO)

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

## Qo'ng'iroqlar (1:1, WebRTC)

Sxemalar `@suhbat/core` (`calls.ts`), mijoz mantiqi
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
