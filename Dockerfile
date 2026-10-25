# syntax=docker/dockerfile:1.7

# Node 22 on Debian trixie ships FFmpeg 7 in the distribution archive.
ARG NODE_IMAGE=node:22-trixie-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# Install workspace dependencies with the lockfile only, so this layer is cached
# until a package manifest changes.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json biome.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/
COPY apps/cli/package.json ./apps/cli/
COPY packages/danmaku/package.json ./packages/danmaku/
COPY packages/db/package.json ./packages/db/
COPY packages/i18n/package.json ./packages/i18n/
COPY packages/installer/package.json ./packages/installer/
COPY packages/media/package.json ./packages/media/
COPY packages/shared/package.json ./packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
# Next.js bakes rewrites into the build, so the container API host must be known here.
ARG API_INTERNAL_URL=http://api:3001
ENV API_INTERNAL_URL=$API_INTERNAL_URL
COPY . .
RUN pnpm exec turbo run build --concurrency=2

# Trim each runtime down to its production dependency tree.
FROM build AS deploy-api
RUN pnpm --filter @uiliuili/api deploy --prod /out/api

FROM build AS deploy-worker
RUN pnpm --filter @uiliuili/worker deploy --prod /out/worker

FROM build AS deploy-cli
RUN pnpm --filter @uiliuili/cli deploy --prod /out/cli

# Shared application runtime. FFmpeg is a system dependency, not bundled into
# the application image's Node dependencies.
FROM ${NODE_IMAGE} AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg tini ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data \
    && chown node:node /data
ENV NODE_ENV=production \
    UILIUILI_ROOT=/data \
    DOTENV_CONFIG_PATH=/data/.env
WORKDIR /app
USER node

FROM runtime AS api
COPY --from=deploy-api --chown=node:node /out/api /app
EXPOSE 3001
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]

FROM runtime AS worker
COPY --from=deploy-worker --chown=node:node /out/worker /app
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]

FROM runtime AS cli
COPY --from=deploy-cli --chown=node:node /out/cli /app
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]

# Next.js standalone server. Static assets are not included in the standalone
# bundle and must be copied next to it.
FROM ${NODE_IMAGE} AS web
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone /app
COPY --from=build --chown=node:node /app/apps/web/.next/static /app/apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public /app/apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# Nginx gateway: serves the admin SPA and proxies API, media and web traffic.
FROM nginx:1.27-alpine AS gateway
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html/admin
EXPOSE 80
