# Backend Patterns & Server Rules

## tRPC Router Structure
- Routers organized by domain in `server/routers/`: `auth`, `books`, `chat`, `files`, `library`, `subscription`
- Combined in `server/routers/index.ts`
- Three procedure types:
  - `publicProcedure`: No auth required (library browse, health check)
  - `protectedProcedure`: Requires valid JWT, provides `ctx.userId`
  - `adminProcedure`: Requires admin role

## Input Validation
- Always validate inputs with Zod schemas
- Use `.positive()` for IDs, `.min(1)` for required strings
- Validate file types and sizes before processing
- Example:
```typescript
input: z.object({
  bookId: z.number().positive(),
  title: z.string().min(1).max(255),
})
```

## Database (Drizzle ORM + PostgreSQL)
- Schema defined in `drizzle/schema.ts`
- Use `db.query.*` for reads (relational queries)
- Use `db.insert/update/delete` for writes
- Always use transactions for multi-table writes
- Use `.returning()` to get inserted/updated records
- Cascade deletes defined in schema foreign keys
- JSONB columns for flexible data (`summaryStructure`, `metadata`, `keywords`)
- Strategic indexes on foreign keys and common query filters

## Authorization Pattern
- Always verify resource ownership before mutations:
```typescript
const book = await ctx.db.query.books.findFirst({
  where: and(
    eq(books.id, input.bookId),
    eq(books.userId, ctx.userId)  // ownership check
  ),
});
if (!book) throw new TRPCError({ code: 'NOT_FOUND' });
```

## AWS S3 Pattern
- Use presigned URLs for client-side uploads (5-min expiry)
- Use presigned URLs for downloads (1-hour expiry)
- Storage paths: `sources/{userId}/{bookId}/{timestamp-random}.{ext}`
- Export paths: `exports/{userId}/{filename}`
- Always delete S3 objects when deleting database records

## Document Processing Pipeline
- BullMQ queue with Redis backend (falls back to sync if Redis unavailable)
- Supported formats: PDF (pdf-parse), DOCX (mammoth), TXT, EPUB
- Full text extracted and stored on `sourceMaterials.extractedText` (no chunking)
- Word count calculated and stored on `sourceMaterials.wordCount`
- Metadata extracted: author, page count, title

## Full-Context Retrieval (No RAG)
- All active source materials included in full in the AI prompt
- Context budget: 600,000 words total (80% of Opus 4.6's ~750K word capacity)
- Dynamic budget: `available = 600K - manuscript words - outline words - 3K overhead`
- Sources included in creation order until budget exhausted
- Grep-style search available for targeted content lookup across sources
- Starred chat messages included as additional context (up to 5)
- Context formatted as XML-like tags in Claude system prompt

## Source Material API
- `files.list` / `files.get`: Return source metadata without `extractedText` (avoid huge payloads)
- `files.toggleActivation`: Toggle `sourceMaterials.isActive` to include/exclude from AI context
- `files.getContextBudget`: Returns word budget breakdown (manuscript, outline, sources, available)
- `files.search`: Grep-style search across all source material text

## Stripe Integration
- Webhook endpoint at `/api/webhooks` (needs raw body for signature verification)
- Handle events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
- Three plans: free, pro ($29/mo), enterprise ($99/mo)
- Usage tracking per resource type: `ai_tokens`, `storage`, `exports`

## Express Server
- CORS configured for frontend origin
- Stripe webhook route registered before JSON body parser
- Static file serving in production with SPA fallback
- Graceful shutdown on SIGTERM/SIGINT
- Health check endpoint at `/health`
