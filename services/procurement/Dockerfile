# syntax=docker/dockerfile:1
# Multi-stage build for @mms/procurement. Built from the monorepo root context:
#   docker build -f services/procurement/Dockerfile -t mms-procurement .
# (docker-compose.yml does this for you — see the root README.)

FROM node:20-slim AS base
RUN corepack enable
WORKDIR /workspace

# ---- deps: install the full workspace so pnpm can resolve @mms/shared -----
FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY libs/shared ./libs/shared
COPY services/procurement ./services/procurement
COPY contracts ./contracts
RUN pnpm install --no-frozen-lockfile

# ---- build: compile @mms/shared then this service --------------------------
FROM deps AS build
RUN pnpm --filter @mms/shared run build
RUN pnpm --filter @mms/procurement exec prisma generate
RUN pnpm --filter @mms/procurement run build

# ---- runtime: slim image with only what's needed to run -------------------
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /workspace/package.json /workspace/pnpm-workspace.yaml ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/libs/shared ./libs/shared
COPY --from=build /workspace/services/procurement ./services/procurement
COPY --from=build /workspace/contracts ./contracts
WORKDIR /workspace/services/procurement
EXPOSE 3002
CMD ["node", "dist/main.js"]
