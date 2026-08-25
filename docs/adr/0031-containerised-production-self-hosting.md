# 31. Containerised production self-hosting with srvx

Amends [0026](0026-postgres-from-compose-app-on-the-host.md).

## Decision

Provide a multi-stage `Dockerfile` and update `compose.yaml` to run both the application and PostgreSQL in containers for production self-hosting. 

The application container uses TanStack Start's officially recommended production runner (`srvx`) to serve static client assets and route server functions, running database migrations (`drizzle-kit migrate`) automatically on container startup.

Development workflows remain intact: `postgres` continues to expose `127.0.0.1:5432`, allowing `pnpm dev` and test suites to run on the host as before.

## Why

ADR 0026 ran only PostgreSQL in Docker, requiring the app to be run on the host via `pnpm dev`. While optimal for active development, users who just want to practice interview sessions need a one-command experience that starts the entire stack in the background without keeping a terminal session open or managing Node toolchains manually.

Containerising the production build provides:
1. **One-command lifecycle**: `docker compose up -d` boots both PostgreSQL and the app, automatically applying schema migrations before serving traffic. `docker compose down` cleanly shuts down all services while preserving transcripts and streak data in the named volume.
2. **Standardised TanStack Start production runtime**: Uses `srvx --prod -s ../client dist/server/server.js` per TanStack's official hosting guidelines, avoiding custom server boilerplate.
3. **Host AI connectivity**: Configures `host.docker.internal` host-gateway mapping so containerised server functions can communicate directly with host-managed Local AI endpoints (Ollama / LM Studio).

## Pros

- **Zero-touch startup**: Database migrations run on boot; users never need to manually execute `pnpm db:migrate`.
- **Clean separation of concerns**: Practice runs in an isolated production container; active development with hot-module reloading remains available via `pnpm dev`.
- **Persistent storage**: Transcripts, question bank, and streak calendar remain permanently safe in the `devhotseat-pgdata` Docker volume.
- **Official ecosystem alignment**: Uses standard `srvx` runner without custom HTTP server scripts.

## Cons

- Initial image build requires ~15–20 seconds to compile the client and server bundles.
- Uses `postgres:17-alpine` rather than 18 to ensure native multi-architecture compatibility across Apple Silicon (`arm64`) and x86 (`amd64`).
