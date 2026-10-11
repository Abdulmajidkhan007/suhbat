# suhbat — loyiha qoidalari

> Repo nomi: `suhbat` (avval `chatapp`). Telegram'ga bog'liq bo'lmagan,
> Telegram'dek ishlaydigan o'zbek messenjeri: veb, desktop (macOS, Windows),
> Android, iOS. Reja va holat: `docs/REJA.md` — yangi sessiya shundan boshlaydi.

## Qarorlar (2026-10-11, egasi tasdiqlagan)
- **Monorepo** (npm workspaces + Turborepo, KidsWear'dagi kabi).
- Backend: **Node.js — NestJS + PostgreSQL + WebSocket**. Firebase'dan
  voz kechiladi (hozirgi CRA ilova Firebase'da).
- Veb: React (Vite). Desktop: Electron (vebni o'raydi). Mobil: **bare React
  Native CLI** (Expo emas).

## Qoidalar
- Til: o'zbekcha; texnik atamalar inglizcha.
- Hech qanday kalit, token, `.env`, parol repoga tushmaydi. Namuna — `.env.example`.
- Holatni bo'rttirmaslik: ishlamaydigan narsa "tayyor" deb yozilmaydi.
- Har bosqich: test/typecheck/lint → commit → push `main`. PR faqat so'ralsa.
- Umumiy kod `packages/` da; ilovalar bir-birini import qilmaydi.
