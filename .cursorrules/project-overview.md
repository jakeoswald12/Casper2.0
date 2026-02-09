# Casper 2.0 - Project Overview

## What This Is
Casper is an AI-powered book writing platform ("The Friendly AI Ghostwriter") built as a full-stack TypeScript SaaS application. It helps authors create, outline, write, and export books using Claude AI with full-context source material inclusion (leveraging Opus 4.6's 1M token context window).

## Architecture
- **Monorepo** with `client/`, `server/`, `shared/`, `drizzle/`, `api/`, `tests/` directories
- **Frontend**: React 19 + Vite + Tailwind CSS v4 + Radix UI + Lexical editor
- **Backend**: Express + tRPC (type-safe API) + Drizzle ORM + PostgreSQL
- **AI**: Claude Opus 4.6 (1M token context) with full source material inclusion + grep search
- **Storage**: AWS S3 with presigned URLs for file uploads/downloads
- **Auth**: JWT tokens (7-day expiry) via `jose` library
- **Payments**: Stripe subscriptions with webhook handling
- **Queue**: BullMQ + Redis for async document processing
- **Deployment**: Vercel (serverless) primary, Railway as alternative

## Key Data Flow
1. **Document Upload -> Processing -> Context**: User uploads file -> S3 presigned URL -> BullMQ processes -> full text extracted and stored on `sourceMaterials.extractedText` -> available for inclusion in AI prompt
2. **Chat with AI**: User message saved -> full context retrieved (all active source text + starred messages) -> Claude API call -> response streamed and stored
3. **Manuscript Export**: Outline + manuscript content -> DOCX generated -> S3 upload -> presigned download URL
4. **Subscriptions**: Stripe checkout -> webhook -> subscription record -> usage tracking against plan limits

## Context Budget
- 600,000 words total (80% of Opus 4.6's ~750K word capacity)
- Dynamically allocated: sources + manuscript + outline + prompt overhead
- As the manuscript grows, available source material capacity shrinks

## Path Aliases
- `@/*` -> `./client/src/*`
- `@server/*` -> `./server/*`
- `@shared/*` -> `./shared/*`

## Environment
- Node.js >= 20.0.0
- pnpm package manager
- PostgreSQL 16+ (via Docker Compose)
- Redis 7+ (via Docker Compose)
- TypeScript strict mode enabled
