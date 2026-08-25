# Stage 1: Build
FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@11.23.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Stage 2: Production runner
FROM node:24-alpine AS runner
RUN corepack enable && corepack prepare pnpm@11.23.0 --activate
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

EXPOSE 3000
CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
