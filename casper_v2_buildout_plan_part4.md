# Casper V2 Build-Out: Part 4 - Testing, Library, Stripe & Deployment

## Phase 7: Testing & Polish (Week 9)

### 🎯 Goals
- Implement comprehensive testing
- Performance optimization
- Error handling
- User experience polish

### Unit Tests with Vitest

```typescript
// server/__tests__/agentExecutor.test.ts

import { describe, it, expect } from 'vitest';
import { executeTool } from '../agentExecutor';
import type { AgentState } from '../agentTools';

describe('Agent Tool Executor', () => {
  it('should update book title', async () => {
    const state: AgentState = {
      bookId: 1,
      title: 'Old Title',
      subtitle: '',
      summary: '',
      writingStyle: '',
      targetAudience: '',
      items: [],
    };
    
    const result = await executeTool('update_book_title', { title: 'New Title' }, state);
    
    expect(result.success).toBe(true);
    expect(state.title).toBe('New Title');
  });
  
  it('should add chapter to outline', async () => {
    const state: AgentState = {
      bookId: 1,
      title: 'Test Book',
      subtitle: '',
      summary: '',
      writingStyle: '',
      targetAudience: '',
      items: [],
    };
    
    const result = await executeTool('add_chapter', {
      content: 'Chapter 1: Introduction',
      position: 0,
    }, state);
    
    expect(result.success).toBe(true);
    expect(state.items).toHaveLength(1);
    expect(state.items[0].type).toBe('chapter');
    expect(state.items[0].content).toBe('Chapter 1: Introduction');
  });
});
```

```typescript
// server/__tests__/ragRetrieval.test.ts

import { describe, it, expect } from 'vitest';
import { retrieveFullContext, searchSources, calculateContextBudget } from '../lib/ragRetrieval';

describe('Full-Context Retrieval System', () => {
  it('should calculate context budget correctly', () => {
    const budget = calculateContextBudget(50_000, 5_000);
    expect(budget.totalBudget).toBe(600_000);
    expect(budget.used).toBe(50_000 + 5_000 + 3_000); // manuscript + outline + overhead
    expect(budget.availableForSources).toBe(600_000 - 58_000);
  });

  it('should not allow negative available budget', () => {
    const budget = calculateContextBudget(600_000, 10_000);
    expect(budget.availableForSources).toBe(0);
  });

  it('should retrieve full context for a book', async () => {
    const context = await retrieveFullContext(1); // bookId

    expect(context.sources).toBeDefined();
    expect(Array.isArray(context.sources)).toBe(true);
    expect(context.budget.totalBudget).toBe(600_000);
  });

  it('should search across source materials', async () => {
    const results = await searchSources(1, 'neural network');

    expect(Array.isArray(results)).toBe(true);
    for (const result of results) {
      expect(result.sourceTitle).toBeDefined();
      expect(result.matches.length).toBeGreaterThan(0);
    }
  });
});
```

### E2E Tests with Playwright

```typescript
// tests/e2e/auth.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should sign up new user', async ({ page }) => {
    await page.goto('/signup');
    
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
  });
  
  test('should login existing user', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('Book Creation', () => {
  test('should create new book', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Create book
    await page.goto('/dashboard');
    await page.click('text=Create New Book');
    
    await page.fill('[name="title"]', 'My Test Book');
    await page.fill('[name="subtitle"]', 'A Subtitle');
    await page.click('button:has-text("Create")');
    
    await expect(page.locator('text=My Test Book')).toBeVisible();
  });
});

test.describe('AI Chat', () => {
  test('should send message to Casper', async ({ page }) => {
    // Assuming logged in and book created
    await page.goto('/studio/book/1');
    
    await page.fill('[placeholder*="Ask Casper"]', 'Add a chapter about introduction');
    await page.press('[placeholder*="Ask Casper"]', 'Enter');
    
    await expect(page.locator('text=Casper is thinking')).toBeVisible();
    await expect(page.locator('text=Casper is thinking')).not.toBeVisible({ timeout: 30000 });
  });
});
```

### Performance Optimization

```typescript
// client/src/lib/optimizations.ts

// Code splitting for heavy components
export const ManuscriptEditor = lazy(() => import('@/components/editor/ManuscriptEditor'));
export const ChatPanel = lazy(() => import('@/components/chat/ChatPanel'));
export const SourcesManager = lazy(() => import('@/components/sources/SourcesManager'));

// Memoized expensive computations
export const useWordCount = (content: string) => {
  return useMemo(() => {
    return content.split(/\s+/).filter(w => w.length > 0).length;
  }, [content]);
};

// Debounced auto-save
export const useDebouncedSave = (callback: Function, delay = 1000) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

// Optimistic updates
export const useOptimisticUpdate = <T>(
  key: string,
  mutationFn: (data: T) => Promise<any>
) => {
  const utils = trpc.useUtils();
  
  return useMutation({
    mutationFn,
    onMutate: async (newData) => {
      await utils.queryClient.cancelQueries({ queryKey: [key] });
      const previousData = utils.queryClient.getQueryData([key]);
      utils.queryClient.setQueryData([key], newData);
      return { previousData };
    },
    onError: (err, newData, context) => {
      utils.queryClient.setQueryData([key], context?.previousData);
    },
    onSettled: () => {
      utils.queryClient.invalidateQueries({ queryKey: [key] });
    },
  });
};
```

### Error Handling

```typescript
// client/src/components/ErrorBoundary.tsx

import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    
    // Send to error tracking service (Sentry)
    if (process.env.NODE_ENV === 'production') {
      // Sentry.captureException(error, { contexts: { react: errorInfo } });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <Card className="max-w-md p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {this.state.error?.message || 'An unexpected error occurred.'}
                </p>
                <Button
                  onClick={() => {
                    this.setState({ hasError: false });
                    window.location.href = '/dashboard';
                  }}
                >
                  Return to Dashboard
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## Phase 8: Library System (Weeks 10-11)

### 🎯 Goals
- Browse published books
- Publishing workflow
- Library search and filters
- Add library books as full-text source materials

### Database Schema

```typescript
// drizzle/schema.ts - Add library tables

export const libraryBooks = pgTable('libraryBooks', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id),
  sourceBookId: integer('sourceBookId').references(() => books.id),
  title: text('title').notNull(),
  author: text('author').notNull(),
  description: text('description'),
  coverImage: text('coverImage'),
  isbn: varchar('isbn', { length: 13 }),
  genre: varchar('genre', { length: 100 }),
  keywords: jsonb('keywords'), // string[]
  isPublic: boolean('isPublic').default(true).notNull(),
  viewCount: integer('viewCount').default(0),
  publishedAt: timestamp('publishedAt').defaultNow().notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  titleSearchIdx: index('libraryBooks_title_search_idx').using('gin', table.title),
  authorIdx: index('libraryBooks_author_idx').on(table.author),
  genreIdx: index('libraryBooks_genre_idx').on(table.genre),
}));

export const libraryBookChapters = pgTable('libraryBookChapters', {
  id: serial('id').primaryKey(),
  libraryBookId: integer('libraryBookId').notNull().references(() => libraryBooks.id, { onDelete: 'cascade' }),
  chapterNumber: integer('chapterNumber').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  wordCount: integer('wordCount').default(0),
}, (table) => ({
  libraryBookIdIdx: index('libraryBookChapters_libraryBookId_idx').on(table.libraryBookId),
}));
```

### Backend: Library Procedures

```typescript
// server/routers.ts

library: {
  // Browse public library
  browse: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      genre: z.string().optional(),
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ input, ctx }) => {
      const { search, genre, limit, offset } = input;
      
      let query = ctx.db.select().from(libraryBooks).where(eq(libraryBooks.isPublic, true));
      
      if (search) {
        query = query.where(
          or(
            sql`${libraryBooks.title} ILIKE ${`%${search}%`}`,
            sql`${libraryBooks.author} ILIKE ${`%${search}%`}`
          )
        );
      }
      
      if (genre) {
        query = query.where(eq(libraryBooks.genre, genre));
      }
      
      const books = await query
        .orderBy(desc(libraryBooks.publishedAt))
        .limit(limit)
        .offset(offset);
      
      return books;
    }),
  
  // Get book details
  getBook: publicProcedure
    .input(z.object({
      bookId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const book = await ctx.db.query.libraryBooks.findFirst({
        where: eq(libraryBooks.id, input.bookId),
        with: {
          chapters: true,
        },
      });
      
      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }
      
      // Increment view count
      await ctx.db.update(libraryBooks)
        .set({ viewCount: sql`${libraryBooks.viewCount} + 1` })
        .where(eq(libraryBooks.id, input.bookId));
      
      return book;
    }),
  
  // Publish book
  publish: protectedProcedure
    .input(z.object({
      bookId: z.number(),
      title: z.string(),
      author: z.string(),
      description: z.string(),
      genre: z.string(),
      isbn: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      coverImage: z.string().optional(),
      isPublic: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const { bookId, ...publishData } = input;
      
      // Get book and manuscripts
      const book = await ctx.db.query.books.findFirst({
        where: and(
          eq(books.id, bookId),
          eq(books.userId, ctx.userId)
        ),
      });
      
      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }
      
      const outline = await ctx.db.query.outlineItems.findMany({
        where: eq(outlineItems.bookId, bookId),
      });
      
      const manuscripts = await ctx.db.query.manuscripts.findMany({
        where: eq(manuscripts.bookId, bookId),
      });
      
      // Create library book
      const libraryBook = await ctx.db.insert(libraryBooks).values({
        userId: ctx.userId,
        sourceBookId: bookId,
        ...publishData,
      }).returning();
      
      // Process chapters
      const chapters = outline
        .filter(item => item.type === 'chapter')
        .map((chapter, index) => {
          const manuscript = manuscripts.find(m => m.chapterId === chapter.id);
          return {
            libraryBookId: libraryBook[0].id,
            chapterNumber: index + 1,
            title: chapter.content,
            content: manuscript?.content || '',
            wordCount: manuscript?.wordCount || 0,
          };
        });
      
      await ctx.db.insert(libraryBookChapters).values(chapters);
      
      return libraryBook[0];
    }),
  
  // Add library book as source to project
  addToProject: protectedProcedure
    .input(z.object({
      libraryBookId: z.number(),
      bookId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get library book with chapters
      const libraryBook = await ctx.db.query.libraryBooks.findFirst({
        where: eq(libraryBooks.id, input.libraryBookId),
        with: { chapters: true },
      });

      if (!libraryBook) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Library book not found',
        });
      }

      // Combine all chapter text into a single extracted text
      const extractedText = libraryBook.chapters
        .sort((a, b) => a.chapterNumber - b.chapterNumber)
        .map((chapter) => `## ${chapter.title}\n\n${chapter.content}`)
        .join('\n\n');

      const wordCount = extractedText
        .split(/\s+/)
        .filter((w) => w.length > 0).length;

      // Create source material with full text (active by default)
      await ctx.db.insert(sourceMaterials).values({
        bookId: input.bookId,
        userId: ctx.userId,
        title: libraryBook.title,
        filename: `library-${libraryBook.id}.txt`,
        fileType: 'library',
        fileSize: Buffer.byteLength(extractedText, 'utf-8'),
        storagePath: '',
        processingStatus: 'completed',
        processedAt: new Date(),
        extractedText,
        wordCount,
        authorName: libraryBook.author,
        isActive: true,
      });

      return { success: true, wordCount };
    }),
},
```

---

## Phase 9: Stripe & Monetization (Weeks 12-13)

### 🎯 Goals
- Stripe subscription integration
- Usage tracking
- Plan management
- Billing portal

### Installation

```bash
pnpm add stripe @stripe/stripe-js @stripe/react-stripe-js
```

### Database Schema

```typescript
// drizzle/schema.ts

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id).unique(),
  stripeCustomerId: text('stripeCustomerId').unique(),
  stripeSubscriptionId: text('stripeSubscriptionId').unique(),
  stripePriceId: text('stripePriceId'),
  plan: varchar('plan', { length: 50 }).notNull(), // 'free', 'pro', 'enterprise'
  status: varchar('status', { length: 50 }).notNull(), // 'active', 'canceled', 'past_due'
  currentPeriodEnd: timestamp('currentPeriodEnd'),
  cancelAtPeriodEnd: boolean('cancelAtPeriodEnd').default(false),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const usageTracking = pgTable('usageTracking', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id),
  resourceType: varchar('resourceType', { length: 50 }).notNull(), // 'ai_tokens', 'storage', 'exports'
  amount: integer('amount').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('usageTracking_userId_idx').on(table.userId),
  typeIdx: index('usageTracking_type_idx').on(table.resourceType),
}));
```

### Stripe Setup

```typescript
// server/lib/stripe.ts

import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// Subscription plans
export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    limits: {
      aiTokens: 100_000, // per month
      storage: 100 * 1024 * 1024, // 100MB
      exports: 5, // per month
    },
  },
  pro: {
    name: 'Pro',
    price: 2900, // $29/month
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID!,
    limits: {
      aiTokens: 5_000_000,
      storage: 5 * 1024 * 1024 * 1024, // 5GB
      exports: -1, // unlimited
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 9900, // $99/month
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
    limits: {
      aiTokens: -1, // unlimited
      storage: -1, // unlimited
      exports: -1, // unlimited
    },
  },
};

export async function createCheckoutSession(
  userId: number,
  plan: 'pro' | 'enterprise',
  email: string
) {
  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    line_items: [
      {
        price: PLANS[plan].stripePriceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${process.env.APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.APP_URL}/pricing?checkout=canceled`,
    metadata: {
      userId: userId.toString(),
      plan,
    },
  });
  
  return session;
}

export async function createCustomerPortalSession(stripeCustomerId: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.APP_URL}/dashboard`,
  });
  
  return session;
}
```

### Webhook Handler

```typescript
// server/webhooks/stripe.ts

import { stripe } from '../lib/stripe';
import { db } from '../db';
import { subscriptions } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string
) {
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
  
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = parseInt(session.metadata!.userId);
      const plan = session.metadata!.plan;
      
      await db.insert(subscriptions).values({
        userId,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        stripePriceId: session.line_items?.data[0].price.id,
        plan,
        status: 'active',
      });
      
      break;
    }
    
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      
      await db.update(subscriptions)
        .set({
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
      
      break;
    }
    
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      
      await db.update(subscriptions)
        .set({
          status: 'canceled',
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
      
      break;
    }
  }
  
  return { received: true };
}
```

---

## Deployment Guide

### Production Environment Setup

```bash
# 1. Set up PostgreSQL database
createdb casper_production

# 2. Set up Redis
# Use AWS ElastiCache or Upstash

# 3. Set up S3 bucket
# Create bucket in AWS console
# Set up CORS and bucket policies

# 4. Environment variables
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
AWS_S3_BUCKET=casper-production
ANTHROPIC_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
JWT_SECRET=...
APP_URL=https://casper.ai
```

### Deployment Options

#### Option 1: Railway (Recommended for MVP)

```yaml
# railway.toml
[build]
builder = "NIXPACKS"
buildCommand = "pnpm install && pnpm build"

[deploy]
startCommand = "pnpm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[services]]
name = "web"
```

```bash
# Deploy
railway up
```

#### Option 2: AWS (Production Scale)

```bash
# Build Docker image
docker build -t casper:latest .

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker tag casper:latest <account>.dkr.ecr.us-east-1.amazonaws.com/casper:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/casper:latest

# Deploy to ECS/Fargate via AWS Console or Terraform
```

### Dockerfile

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY client/package.json ./client/

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Monitoring Setup

```typescript
// server/lib/monitoring.ts

import * as Sentry from '@sentry/node';

export function initMonitoring() {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  }
}

export function captureError(error: Error, context?: any) {
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, { extra: context });
  } else {
    console.error('Error:', error, context);
  }
}
```

---

## Success Checklist

### Week 1-2: Foundation ✅
- [ ] PostgreSQL database set up
- [ ] All schema migrations applied
- [ ] File upload working with S3
- [ ] Document processing pipeline operational
- [ ] Full-context retrieval and grep search working

### Week 3-4: Editor ✅
- [ ] Lexical editor rendering correctly
- [ ] Line numbers displaying
- [ ] Section markers working
- [ ] AI content insertion functional
- [ ] Typewriter effect smooth

### Week 5: Chat ✅
- [ ] Chat messages persisting
- [ ] Session management working
- [ ] Message starring functional
- [ ] Starred messages in AI context

### Week 6: Summary ✅
- [ ] Hierarchical summary structure
- [ ] Drag-and-drop working
- [ ] Auto-save operational

### Week 7: Export ✅
- [ ] DOCX export generating correctly
- [ ] Proper formatting
- [ ] Download working

### Week 8: Settings ✅
- [ ] All settings saving
- [ ] Theme switching working
- [ ] AI preferences applying

### Week 9: Polish ✅
- [ ] All tests passing
- [ ] No console errors
- [ ] Performance optimized
- [ ] Error handling comprehensive

### Weeks 10-13: Advanced ✅
- [ ] Library browsing working
- [ ] Publishing functional
- [ ] Stripe checkout working
- [ ] Webhooks processing

---

## Launch Preparation

1. **Security Audit**
   - SQL injection prevention
   - XSS protection
   - CSRF tokens
   - Rate limiting
   - API key rotation

2. **Performance Testing**
   - Load testing with 100+ concurrent users
   - Database query optimization
   - CDN setup
   - Image optimization

3. **Documentation**
   - User guide
   - API documentation
   - Developer onboarding

4. **Marketing**
   - Landing page
   - Demo video
   - Blog announcement
   - Social media

---

## Congratulations! 🎉

You now have a production-ready Casper platform with:
- ✅ State-of-the-art AI integration
- ✅ Professional rich text editing
- ✅ Full-context source material inclusion with grep search
- ✅ Complete monetization system
- ✅ Scalable architecture
- ✅ Comprehensive testing

**Ready to help authors write their best books yet!** 📚✨
