# Veb production image (Railway shu Dockerfile'ni quradi). Build context — REPO ILDIZI:
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.suhbat.uz -t suhbat-web .
# Docker Hub limitga tushsa: --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-slim
ARG NODE_IMAGE=node:22-slim
ARG CADDY_IMAGE=caddy:2-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /repo
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/client/package.json packages/client/
COPY packages/ui-tokens/package.json packages/ui-tokens/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=@suhbat/web --include-workspace-root --ignore-scripts
COPY packages/core packages/core
COPY packages/client packages/client
COPY packages/ui-tokens packages/ui-tokens
COPY apps/web apps/web
# Vite o'zgaruvchisi build vaqtida bundle'ga qotadi — o'zgarsa qayta build kerak.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build -w @suhbat/core -w @suhbat/client -w @suhbat/ui-tokens \
 && npm run build -w @suhbat/web

FROM ${CADDY_IMAGE} AS runtime
COPY apps/web/docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
# Non-root: Caddy 1024+ port va yozish mumkin bo'lgan XDG papkalar bilan ishlaydi.
ENV XDG_DATA_HOME=/tmp/caddy-data XDG_CONFIG_HOME=/tmp/caddy-config PORT=8080
RUN mkdir -p /tmp/caddy-data /tmp/caddy-config && chown -R 65534:65534 /tmp/caddy-data /tmp/caddy-config
USER 65534:65534
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
