# suhbat

O'zbek messenjeri — veb, desktop, Android, iOS. Reja va holat: [`docs/REJA.md`](docs/REJA.md).

## Tuzilish

```
apps/
  api/    NestJS 11 + Prisma 7 + PostgreSQL (health, auth)
  web/    React 19 + Vite (hozircha Firebase'da ishlaydi)
packages/
  core/   zod sxemalar, tiplar, umumiy yordamchilar
```

## Ishga tushirish

Talab: Node 22+, Docker.

```bash
npm install                          # apps/api uchun Prisma client ham yaratiladi
npm run db:up                        # Postgres (docker compose)

cp apps/api/.env.example apps/api/.env
npm run db:migrate -w @suhbat/api    # migratsiyalar
npm run dev -w @suhbat/api           # http://localhost:4000/health

cp apps/web/.env.example apps/web/.env   # Firebase qiymatlarini kiriting
npm run dev -w @suhbat/web               # http://localhost:3000
```

`@suhbat/core` avval build qilinishi kerak (`npm run build -w @suhbat/core`);
`npx turbo run dev` buni o'zi qiladi.

## Tekshiruvlar

```bash
npm run lint && npm run typecheck && npm run test   # turbo orqali hamma paketda
npm run test:e2e -w @suhbat/api                     # Postgres ishlab turishi kerak
```

## API (hozircha)

| Metod | Yo'l             | Izoh                                   |
|-------|------------------|----------------------------------------|
| GET   | `/health`        | API va DB holati                       |
| POST  | `/auth/register` | `{ email, password, displayName }`     |
| POST  | `/auth/login`    | `{ email, password }` → `accessToken`  |
| GET   | `/auth/me`       | `Authorization: Bearer <accessToken>`  |
