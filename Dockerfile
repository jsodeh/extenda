FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app

# Install dependencies (including workspace packages)
RUN pnpm install --frozen-lockfile

# Build shared package
RUN pnpm --filter @extenda/shared build

# Build API
RUN pnpm --filter api build

FROM base AS app
WORKDIR /usr/src/app

# Copy necessary files
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/packages/shared/dist ./packages/shared/dist
COPY --from=build /usr/src/app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /usr/src/app/apps/api/dist ./apps/api/dist
COPY --from=build /usr/src/app/apps/api/package.json ./apps/api/package.json
# Copy nested node_modules if they exist (pnpm structure)
COPY --from=build /usr/src/app/apps/api/node_modules ./apps/api/node_modules
# Copy schema/migrations if needed at runtime
COPY --from=build /usr/src/app/apps/api/src/db ./apps/api/src/db
COPY --from=build /usr/src/app/apps/api/migrations ./apps/api/migrations

EXPOSE 8080
CMD [ "node", "apps/api/dist/index.js" ]
