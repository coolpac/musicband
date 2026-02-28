# AGENTS.md

## Cursor Cloud specific instructions

This is a two-service monorepo (frontend + backend) for a **Telegram Mini App** — a music event management platform ("Музыканты" / ВГУЛ). No workspace-level package manager is used; each service has its own `package.json` and lock file.

### Services overview

| Service | Dir | Dev command | Port | Notes |
|---------|-----|-------------|------|-------|
| Frontend (React + Vite) | `frontend/` | `npm run dev` | 5173 | Supports mock mode (`VITE_USE_MOCK=true` in `.env.local`) |
| Backend (Express + Prisma) | `backend/` | `npm run dev` | 3000 | Requires PostgreSQL and Redis |
| PostgreSQL 16 | Docker | `docker run -d --name musicians-db -e POSTGRES_DB=musicians_db -e POSTGRES_USER=musicians -e POSTGRES_PASSWORD=devpassword -p 5432:5432 postgres:16-alpine` | 5432 | |
| Redis 7 | Docker | `docker run -d --name musicians-redis -p 6379:6379 redis:7-alpine` | 6379 | No password in dev |

### Running lint / type-check / tests / build

See `backend/package.json` and `frontend/package.json` `"scripts"` sections. Key commands:

- **Backend**: `npm run lint`, `npm run type-check`, `npm test`, `npm run build` (from `backend/`)
- **Frontend**: `npm run build` (from `frontend/`). No dedicated lint script in frontend.
- **CI**: `.github/workflows/ci.yml` runs `npm ci && npm run build` for frontend and `npm ci && npm run type-check && npm run lint && npm run build` for backend.

### Non-obvious caveats

- **Backend lint has 5 pre-existing errors** (formatting + unsafe-any in `UserBot.ts`, `PublicVoteController.ts`, `validator.ts`). These are not caused by the dev setup.
- **Frontend mock mode**: Set `VITE_USE_MOCK=true` in `frontend/.env.local` to run the frontend without a backend. Songs, voting, and admin UI all work with mock data. Set `VITE_USE_MOCK=false` and `VITE_API_URL=http://localhost:3000` to connect to the real backend.
- **Admin panel requires Telegram auth**: The admin panel at `/admin` uses Telegram bot initData for authentication. Without a real Telegram bot token, admin panel login is not accessible outside mock mode.
- **Backend `.env`**: Copy `backend/.env.example` to `backend/.env`. Key values for local dev: `DATABASE_URL=postgresql://musicians:devpassword@localhost:5432/musicians_db`, `REDIS_HOST=localhost`, `REDIS_PORT=6379`, `REDIS_PASSWORD=` (empty), `JWT_SECRET=<any 32+ char string>`, `TELEGRAM_ADMIN_BOT_TOKEN=fake:dev-token`.
- **Prisma migrations**: Run `npx prisma migrate deploy` (from `backend/`) after setting up the database. Run `npx prisma generate` if `@prisma/client` is stale.
- **Docker in Cloud Agent**: Docker must be installed and configured with `fuse-overlayfs` storage driver and `iptables-legacy`. See the environment setup for details.
- **Node.js**: The project targets Node 20 (per CI). The environment has Node 22 which is compatible.
