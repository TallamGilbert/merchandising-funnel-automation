# syntax=docker/dockerfile:1
# Multi-stage build for @mms/financials. Built from the monorepo root context:
#   docker build -f services/financials/Dockerfile -t mms-financials .
# (docker-compose.yml does this for you — see the root README.)

FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# Pin pnpm: an unpinned corepack pulls the newest pnpm, which refuses to run
# Prisma/Nest install scripts without an explicit approve-builds list.
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /workspace

# ---- deps: install the full workspace so pnpm can resolve @mms/shared -----
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY libs/shared ./libs/shared
COPY services/financials ./services/financials
COPY contracts ./contracts
RUN pnpm install --frozen-lockfile

# ---- build: compile @mms/shared then this service --------------------------
FROM deps AS build
RUN pnpm --filter @mms/shared run build
RUN pnpm --filter @mms/financials exec prisma generate
RUN pnpm --filter @mms/financials run build
RUN mkdir -p services/financials/dist/generated && cp -r services/financials/src/generated/. services/financials/dist/generated/

# ---- runtime: slim image with only what's needed to run -------------------
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /workspace/package.json /workspace/pnpm-workspace.yaml ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/libs/shared ./libs/shared
COPY --from=build /workspace/services/financials ./services/financials
COPY --from=build /workspace/contracts ./contracts
WORKDIR /workspace/services/financials
EXPOSE 3008
CMD ["node", "dist/main.js"]
