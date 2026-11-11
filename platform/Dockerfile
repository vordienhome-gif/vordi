# Vordi platform imajları (tek Dockerfile, iki hedef):
#   api   — çekirdek backend
#   caddy — HTTPS + yönetim paneli ve depo uygulamasının derlenmiş dosyaları
FROM node:22-alpine AS base
RUN npm install -g pnpm@10.28.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/depo/package.json apps/depo/
COPY packages/domain/package.json packages/domain/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile
COPY . .

FROM base AS web
RUN pnpm --filter @vordi/admin --filter @vordi/depo build

FROM base AS api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "--import", "tsx", "src/index.ts"]

FROM caddy:2-alpine AS caddy
COPY --from=web /app/apps/admin/dist /srv/admin
COPY --from=web /app/apps/depo/dist /srv/depo
COPY deploy/Caddyfile /etc/caddy/Caddyfile
