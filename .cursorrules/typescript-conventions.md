# TypeScript Conventions

## General Rules
- Strict mode is enabled (`"strict": true` in tsconfig.json)
- Target ES2022 with ESNext module system
- Always use TypeScript - never plain JavaScript
- Prefer `interface` for object shapes, `type` for unions/intersections
- Use Zod schemas for runtime validation (especially tRPC inputs)
- Export types from `drizzle/schema.ts` using `$inferSelect` and `$inferInsert`

## Naming Conventions
- **Files**: camelCase for utilities (`ragRetrieval.ts`), PascalCase for React components (`ChatPanel.tsx`)
- **Variables/Functions**: camelCase (`createSession`, `handleSubmit`)
- **Types/Interfaces**: PascalCase (`SummaryItem`, `AgentState`)
- **Constants**: UPPER_SNAKE_CASE for config (`PLANS`, `DEFAULT_SUMMARY`)
- **Database tables**: camelCase (`chatSessions`, `sourceMaterials`)
- **Database columns**: camelCase (`bookId`, `createdAt`)

## Import Order
1. Node built-ins / external packages
2. Internal aliases (`@/`, `@server/`, `@shared/`)
3. Relative imports
4. Type-only imports last

## Type Safety
- Use Drizzle's type inference for database types - do not duplicate
- tRPC provides end-to-end type safety - trust the types from router to client
- Prefer `z.infer<typeof schema>` over manual type definitions when a Zod schema exists
- Always type function parameters and return types for exported functions
- Use `as const` for literal type narrowing

## Error Handling
- Use `TRPCError` with appropriate codes (`NOT_FOUND`, `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`) on the server
- Never silently swallow errors - always log or rethrow
- Use try-catch in async operations, especially S3/Stripe/Claude API calls
- Frontend: Use `toast` (sonner) for user-facing errors
