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
- Har bosqich: test/typecheck/lint → commit → o'z branch'iga push → `main`ga PR
  → CI yashil va tekshiruvdan o'tgach merge. `main`ga to'g'ridan-to'g'ri push
  qilinmaydi; eng oxirgi ish doim `main`da bo'ladi.

## Sessiyalar tartibi (2026-10-11 dan)
- **Asosiy sessiya — tekshiruvchi.** Kod yozmaydi. Har faza uchun yangi ishchi
  sessiya ochadi (vazifaga qarab Opus yoki Sonnet), unga prompt beradi, ishchi
  ochgan PR'ni ko'rib chiqadi (diff, CI, `docs/REJA.md` ga mosligi) va merge
  qiladi yoki tuzatish so'raydi.
- **Ishchi sessiya.** Faqat o'ziga berilgan fazani bajaradi, branch'da ishlaydi,
  PR ochadi va `docs/REJA.md` holatini yangilaydi. PR'ni o'zi merge qilmaydi.
- Umumiy kod `packages/` da; ilovalar bir-birini import qilmaydi.
