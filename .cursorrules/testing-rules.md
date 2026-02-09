# Testing Rules

## Test Framework
- **Unit tests**: Vitest (in `server/__tests__/` and `tests/`)
- **E2E tests**: Playwright (in `tests/e2e/`)
- **Coverage**: V8 provider via Vitest

## Running Tests
```bash
pnpm test          # Run unit tests (watch mode)
pnpm test:e2e      # Run Playwright E2E tests
pnpm typecheck     # TypeScript type checking
pnpm lint          # ESLint
```

## Unit Test Conventions
- Test files: `*.test.ts` co-located with source or in `__tests__/`
- Use `describe` blocks grouped by function/feature
- Use `it` or `test` with descriptive names
- Mock external services (Anthropic SDK, AWS S3, Stripe) - see `tests/setup.ts`
- Test both success and error paths
- Test edge cases: empty inputs, invalid IDs, unauthorized access

## E2E Test Conventions
- Tests in `tests/e2e/` directory
- Base URL: `http://localhost:5173` (dev server must be running)
- Multi-browser: Chromium, Firefox, WebKit
- Test user flows: auth, book creation, chat, export
- Use page objects pattern for reusable selectors

## Test Setup (`tests/setup.ts`)
- Environment variables mocked for test isolation
- External SDKs mocked:
  - `@anthropic-ai/sdk`: Mock message creation
  - `@aws-sdk/client-s3`: Mock S3 operations
  - `@aws-sdk/s3-request-presigner`: Mock presigned URLs

## What to Test
- **Server routers**: Input validation, authorization, CRUD operations
- **RAG retrieval**: Keyword extraction, chunk scoring, context building
- **Document processing**: Text extraction, chunking algorithm
- **Auth**: Token creation/verification, middleware behavior
- **Export**: DOCX generation, outline tree building
- **Frontend**: Component rendering, user interactions, form validation

## Coverage Target
- Aim for 80%+ coverage on server-side code
- Focus on business logic, not framework boilerplate
