# @snackmanager/app — production image (static SPA served by nginx, which also
# reverse-proxies /api and /socket.io to the `server` container).
# Build context = repo root:  docker build -f packages/app/Dockerfile .

FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/app/package.json ./packages/app/
RUN pnpm install --frozen-lockfile --filter "@snackmanager/app..."

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/app ./packages/app

# Baked into the bundle by Vite at build time.
ARG VITE_API_URL
ARG VITE_DEFAULT_MODE=server
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEFAULT_MODE=$VITE_DEFAULT_MODE

RUN pnpm --filter @snackmanager/shared build \
 && pnpm --filter @snackmanager/app build

# --- runtime -------------------------------------------------------------
FROM nginx:1.29-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/packages/app/dist /usr/share/nginx/html
EXPOSE 80
