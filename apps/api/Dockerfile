# Production image. Build context — REPO ILDIZI (monorepo):
#   docker build -f apps/api/Dockerfile -t suhbat-api .
# Docker Hub limitga tushsa: --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-slim
ARG NODE_IMAGE=node:22-slim

FROM ${NODE_IMAGE} AS build
WORKDIR /repo
# Faqat API va u bog'liq paketlar manifestlari — qatlam keshi uchun.
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/client/package.json packages/client/
COPY apps/api/package.json apps/api/
# Boshqa workspace'lar (web, mobile, desktop, ui-tokens) kerak emas: lockfile
# bilan mos qolishi uchun `npm ci` ularni --workspace bilan cheklaydi.
RUN npm ci --workspace=@suhbat/api --include-workspace-root --ignore-scripts
COPY packages/core packages/core
COPY packages/client packages/client
COPY apps/api apps/api
# prisma generate bazasiz ishlaydi; core/client dist, keyin API.
RUN npm run build -w @suhbat/core -w @suhbat/client \
 && npm run postinstall -w @suhbat/api \
 && npm run build -w @suhbat/api
# Faqat production bog'liqliklar (generated Prisma client src ichida — dist'ga kompilyatsiya bo'ladi).
RUN npm prune --omit=dev --workspace=@suhbat/api --include-workspace-root

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /repo
# Prisma engine uchun OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/package.json ./package.json
COPY --from=build --chown=node:node /repo/packages/core/package.json ./packages/core/package.json
COPY --from=build --chown=node:node /repo/packages/core/dist ./packages/core/dist
COPY --from=build --chown=node:node /repo/packages/client/package.json ./packages/client/package.json
COPY --from=build --chown=node:node /repo/packages/client/dist ./packages/client/dist
COPY --from=build --chown=node:node /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /repo/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --chmod=755 apps/api/docker/entrypoint.sh /usr/local/bin/suhbat-api
USER node
WORKDIR /repo/apps/api
EXPOSE 4000
# Railway PORT beradi (kodda process.env.PORT). Migratsiya, so'ng server.
# Root bilan ishga tushsa (Volume uchun RAILWAY_RUN_UID=0) — entrypoint `node` ga tushadi.
CMD ["suhbat-api"]
