# syntax=docker/dockerfile:1
# Multi-stage build for @mms/warehouse-operations. Built from the monorepo root context:
#   docker build -f services/warehouse-operations/Dockerfile -t mms-warehouse-operations .
# (docker-compose.yml does this for you — see the root README.)

FROM node:20-slim AS base
RUN corepack enable
WORKDIR /workspace

# ---- deps: install the full workspace so pnpm can resolve @mms/shared -----
FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY libs/shared ./libs/shared
COPY services/warehouse-operations ./services/warehouse-operations
COPY contracts ./contracts
RUN pnpm install --no-frozen-lockfile

# ---- build: compile @mms/shared then this service --------------------------
FROM deps AS build
RUN pnpm --filter @mms/shared run build
RUN pnpm --filter @mms/warehouse-operations exec prisma generate
RUN pnpm --filter @mms/warehouse-operations run build

# ---- runtime: slim image with only what's needed to run -------------------
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /workspace/package.json /workspace/pnpm-workspace.yaml ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/libs/shared ./libs/shared
COPY --from=build /workspace/services/warehouse-operations ./services/warehouse-operations
COPY --from=build /workspace/contracts ./contracts
WORKDIR /workspace/services/warehouse-operations
EXPOSE 3005
CMD ["node", "dist/main.js"]
