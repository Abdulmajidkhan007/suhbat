import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` bazasiz ham ishlashi uchun (CI typecheck) — majburiy emas;
  // migrate buyruqlari DATABASE_URL'siz xato beradi.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
