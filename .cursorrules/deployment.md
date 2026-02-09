# Deployment & DevOps

## Development
```bash
pnpm install              # Install dependencies
docker compose up -d      # Start PostgreSQL + Redis
cp .env.example .env      # Configure environment
pnpm db:push              # Push schema to database
pnpm dev                  # Start dev server (client + server concurrently)
```

## Build
```bash
pnpm build                # Build client (Vite) + server (tsc)
pnpm build:client         # Build frontend only
pnpm build:server         # Build backend only
pnpm start                # Run production server
```

## Deployment Targets

### Vercel (Primary - Serverless)
- Config: `vercel.json`
- API routes in `api/` directory are deployed as serverless functions
- Client built with Vite, served as static assets
- API functions: 1024MB memory, 60s timeout
- Routes: `/api/trpc/*`, `/api/webhooks`, `/api/health`
- SPA fallback for client-side routing
- Note: `api/db-serverless.ts` is a standalone DB module (can't import from `server/`)

### Railway (Alternative)
- Config: `railway.toml`
- NIXPACKS builder
- Build: `pnpm install && pnpm build`
- Start: `pnpm start`
- Health check at `/health`

### Docker
- Multi-stage Dockerfile (builder + production)
- `docker-compose.yml` for local PostgreSQL + Redis
- Health check: wget to `http://localhost:3000/health`

## Infrastructure
- **Database**: PostgreSQL 16 (Docker locally, managed service in production)
- **Cache/Queue**: Redis 7 (Docker locally, ElastiCache/Upstash in production)
- **Storage**: AWS S3 (presigned URLs, no direct public access)
- **Monitoring**: Sentry for error tracking (optional in dev)

## Key Scripts
```bash
pnpm dev              # Full dev environment
pnpm test             # Unit tests (Vitest, watch mode)
pnpm test:e2e         # E2E tests (Playwright)
pnpm typecheck        # TypeScript validation
pnpm lint             # ESLint
pnpm format           # Prettier formatting
pnpm db:generate      # Generate migration SQL
pnpm db:migrate       # Apply migrations
pnpm db:push          # Push schema (dev shortcut)
pnpm db:studio        # Drizzle Studio GUI
```
