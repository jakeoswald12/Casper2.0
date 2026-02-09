# File Structure & Organization

## Directory Layout
```
casper2/
├── .cursorrules/          # Cursor AI rules (this directory)
├── api/                   # Vercel serverless functions
│   ├── db-serverless.ts   # Standalone DB module for Vercel
│   ├── health.ts          # Health check endpoint
│   ├── trpc.ts            # tRPC serverless handler
│   └── webhooks.ts        # Stripe webhook handler
├── client/                # Frontend (React + Vite)
│   ├── index.html         # SPA entry point
│   └── src/
│       ├── main.tsx       # React app bootstrap (QueryClient, tRPC)
│       ├── App.tsx        # Routing (wouter)
│       ├── index.css      # Global styles + Tailwind
│       ├── lib/           # Utilities
│       │   ├── trpc.ts    # tRPC React client
│       │   └── utils.ts   # cn(), formatBytes()
│       ├── components/
│       │   ├── ui/        # Radix UI primitives (button, card, dialog, etc.)
│       │   ├── editor/    # Lexical manuscript editor + plugins + nodes
│       │   ├── chat/      # AI chat panel
│       │   ├── sources/   # Source material upload/management
│       │   ├── summary/   # Book summary editor (drag-and-drop)
│       │   ├── export/    # DOCX export button
│       │   ├── settings/  # User preference panels
│       │   └── library/   # Published book cards
│       └── pages/         # Route pages
│           ├── Landing.tsx
│           ├── Dashboard.tsx
│           ├── Studio.tsx     # Main workspace
│           ├── Settings.tsx
│           ├── Library.tsx
│           ├── LibraryBook.tsx
│           └── Pricing.tsx
├── server/                # Backend (Express + tRPC)
│   ├── index.ts           # Express server entry
│   ├── db.ts              # Drizzle DB connection
│   ├── trpc.ts            # tRPC setup + middleware
│   ├── routers/           # tRPC procedure routers
│   │   ├── index.ts       # Combined router
│   │   ├── auth.ts
│   │   ├── books.ts
│   │   ├── chat.ts
│   │   ├── files.ts
│   │   ├── library.ts
│   │   └── subscription.ts
│   ├── lib/               # Server utilities
│   │   ├── auth.ts        # JWT sign/verify, auth middleware
│   │   ├── s3.ts          # AWS S3 operations
│   │   ├── stripe.ts      # Stripe config, plans, checkout
│   │   ├── ragRetrieval.ts # RAG context building
│   │   ├── docxExport.ts  # DOCX generation
│   │   └── monitoring.ts  # Sentry + request logging
│   ├── queue/
│   │   └── documentProcessor.ts  # BullMQ document processing
│   ├── webhooks/
│   │   └── stripe.ts      # Stripe event handlers
│   └── __tests__/         # Server unit tests
├── shared/                # Shared types between client/server
│   └── types.ts           # SummaryItem, DEFAULT_SUMMARY, OutlineItemType
├── drizzle/               # Database
│   ├── schema.ts          # All table definitions
│   └── migrations/        # Generated SQL migrations
├── tests/                 # Test infrastructure
│   ├── setup.ts           # Vitest global setup + mocks
│   └── e2e/               # Playwright E2E tests
└── [config files]         # package.json, tsconfig, vite.config, etc.
```

## Where to Put New Code
- **New UI component**: `client/src/components/{feature}/ComponentName.tsx`
- **New API endpoint**: `server/routers/{domain}.ts` (add procedure to existing router)
- **New database table**: `drizzle/schema.ts` (add table + type export)
- **New server utility**: `server/lib/{utilName}.ts`
- **New shared type**: `shared/types.ts`
- **New Vercel function**: `api/{endpoint}.ts`
- **New unit test**: `server/__tests__/{feature}.test.ts` or co-located `*.test.ts`
- **New E2E test**: `tests/e2e/{feature}.spec.ts`

## File Naming
- React components: PascalCase (`ChatPanel.tsx`, `SummaryEditor.tsx`)
- Utilities/modules: camelCase (`ragRetrieval.ts`, `docxExport.ts`)
- Test files: `*.test.ts` (unit) or `*.spec.ts` (E2E)
- Config files: lowercase with dots (`drizzle.config.ts`, `vite.config.ts`)
