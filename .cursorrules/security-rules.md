# Security Rules

## Sensitive Data
- **NEVER** commit `.env` files - use `.env.example` as template
- **NEVER** expose API keys (Anthropic, Stripe, AWS) to the frontend
- **NEVER** store passwords in plain text
- **NEVER** log sensitive tokens or credentials
- All secrets accessed via `process.env` on the server only

## Authentication
- JWT tokens signed with `JWT_SECRET` via `jose` library
- Tokens expire after 7 days
- Token sent via `Authorization: Bearer <token>` header or `token` cookie
- Always verify token in `protectedProcedure` middleware before accessing user data

## Authorization
- Every mutation must verify the authenticated user owns the resource
- Check `userId` matches on books, chat sessions, source materials before any modification
- Use `adminProcedure` for admin-only operations
- Never trust client-provided userId - always use `ctx.userId` from JWT

## Input Validation
- All tRPC inputs validated with Zod schemas
- File uploads validated for type and size before S3 presigned URL generation
- Allowed file types: PDF, DOCX, TXT, EPUB only
- Max file size: 10MB
- Sanitize user-generated content before rendering (XSS prevention)

## API Security
- CORS configured for specific frontend origin
- Stripe webhooks verified with `constructEvent` signature validation
- Rate limiting should be implemented for production
- SQL injection prevented by Drizzle ORM parameterized queries

## Environment Variables Required
```
DATABASE_URL          # PostgreSQL connection string
REDIS_URL             # Redis connection URL
AWS_S3_BUCKET         # S3 bucket name
AWS_S3_REGION         # S3 region
AWS_ACCESS_KEY_ID     # AWS credentials
AWS_SECRET_ACCESS_KEY # AWS credentials
ANTHROPIC_API_KEY     # Claude API key
JWT_SECRET            # JWT signing secret
STRIPE_SECRET_KEY     # Stripe server key
STRIPE_WEBHOOK_SECRET # Stripe webhook verification
```

## S3 Security
- Presigned upload URLs expire in 5 minutes
- Presigned download URLs expire in 1 hour
- Storage paths include userId to prevent cross-user access
- Delete S3 objects when database records are deleted
