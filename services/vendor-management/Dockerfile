# syntax=docker/dockerfile:1
# Multi-stage build for @mms/vendor-management. Built from the monorepo root context:
#   docker build -f services/vendor-management/Dockerfile -t mms-vendor-management .
# (docker-compose.yml does this for you — see the root README.)

FROM node:20-slim AS base
RUN corepack enable
WORKDIR /workspace

# ---- deps: install the full workspace so pnpm can resolve @mms/shared -----
FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY libs/shared ./libs/shared
COPY services/vendor-management ./services/vendor-management
COPY contracts ./contracts
RUN pnpm install --no-frozen-lockfile

# ---- build: compile @mms/shared then this service --------------------------
FROM deps AS build
RUN pnpm --filter @mms/shared run build
RUN pnpm --filter @mms/vendor-management exec prisma generate
RUN pnpm --filter @mms/vendor-management run build

# ---- runtime: slim image with only what's needed to run -------------------
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /workspace/package.json /workspace/pnpm-workspace.yaml ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/libs/shared ./libs/shared
COPY --from=build /workspace/services/vendor-management ./services/vendor-management
COPY --from=build /workspace/contracts ./contracts
WORKDIR /workspace/services/vendor-management
EXPOSE 3001
CMD ["node", "dist/main.js"]
