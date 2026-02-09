# Casper V2 Build-Out: Master Implementation Plan
## State-of-the-Art Full-Stack Development Roadmap

**Project:** Casper - The Friendly AI Ghostwriter  
**Goal:** Achieve feature parity with V1 using V2's superior architecture  
**Timeline:** 9 weeks to MVP, 15 weeks to full feature set  
**Approach:** Modern best practices, clean code, scalable architecture

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Development Environment Setup](#development-environment-setup)
3. [Phase 1: Foundation & Source Material System](#phase-1-foundation--source-material-system-weeks-1-2)
4. [Phase 2: Lexical Rich Text Editor](#phase-2-lexical-rich-text-editor-weeks-3-4)
5. [Phase 3: Chat Persistence & Enhancement](#phase-3-chat-persistence--enhancement-week-5)
6. [Phase 4: Summary Editor](#phase-4-summary-editor-week-6)
7. [Phase 5: Export System](#phase-5-export-system-week-7)
8. [Phase 6: Settings & Configuration](#phase-6-settings--configuration-week-8)
9. [Phase 7: Testing & Polish](#phase-7-testing--polish-week-9)
10. [Phase 8: Library System](#phase-8-library-system-weeks-10-11)
11. [Phase 9: Stripe & Monetization](#phase-9-stripe--monetization-weeks-12-13)
12. [Phase 10: Advanced Features](#phase-10-advanced-features-weeks-14-15)
13. [Code Standards & Best Practices](#code-standards--best-practices)
14. [Testing Strategy](#testing-strategy)
15. [Deployment Guide](#deployment-guide)

---

## Executive Summary

### What We're Building

Transform V2 from a clean MVP into a production-ready AI-powered book writing platform with:
- ✅ Document upload & full-context source material system
- ✅ Lexical rich text editor with AI integration
- ✅ Persistent chat with sessions
- ✅ Hierarchical summary editor
- ✅ Professional DOCX export
- ✅ Library marketplace for published books
- ✅ Stripe subscriptions & usage tracking
- ✅ Advanced analytics & voice features

### Architecture Principles

1. **Type Safety First:** End-to-end TypeScript with tRPC
2. **Clean Separation:** Frontend (React 19) + Backend (Express) clearly separated
3. **State Management:** Zustand for complex state, React Query via tRPC for server state
4. **Modern Patterns:** Hooks, composition, functional programming
5. **Performance:** Code splitting, lazy loading, optimistic updates
6. **Testing:** Unit tests with Vitest, E2E with Playwright
7. **Developer Experience:** Fast HMR, great error messages, clear conventions

### Technology Stack Enhancements

**Keep from V2:**
- React 19
- Vite
- Express + tRPC
- Drizzle ORM
- Claude Opus 4.6 (1M token context window)
- Radix UI + Tailwind CSS v4

**Add for Production:**
- Zustand (state management)
- Lexical (rich text editor)
- BullMQ (job queue for document processing)
- Redis (caching & sessions)
- PostgreSQL (migrate from MySQL)
- AWS S3 (file storage - already in V2)
- Stripe (payments)
- Sentry (error tracking)

---

## Development Environment Setup

### Prerequisites

```bash
# System Requirements
- Node.js 20+
- pnpm 9+
- PostgreSQL 16+ (or Docker)
- Redis 7+ (or Docker)
- AWS S3 bucket (or localstack for dev)

# Install global tools
npm install -g pnpm tsx drizzle-kit

# Optional but recommended
docker compose  # for databases
```

### Initial Setup

```bash
# 1. Clone and install
cd casper2
pnpm install

# 2. Set up databases
docker compose up -d postgres redis

# 3. Environment variables
cp .env.example .env

# Required environment variables:
DATABASE_URL=postgresql://user:password@localhost:5432/casper
REDIS_URL=redis://localhost:6379
AWS_S3_BUCKET=casper-dev
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
ANTHROPIC_API_KEY=your-anthropic-key
JWT_SECRET=your-jwt-secret

# 4. Run migrations
pnpm db:push

# 5. Start dev server
pnpm dev
```

### Development Tools

```bash
# Install recommended VS Code extensions
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension Prisma.prisma

# Set up git hooks
pnpm husky install
```

---

## Phase 1: Foundation & Source Material System (Weeks 1-2)

### 🎯 Goals
- Migrate from MySQL to PostgreSQL
- Add database schema for source material system
- Implement file upload with progress tracking
- Build document processing pipeline (full-text extraction, no chunking)
- Create full-context retrieval and grep search system

### Database Migration: MySQL → PostgreSQL

**Why PostgreSQL?**
- JSONB support for flexible schemas
- Better full-text search (GIN indexes)
- Industry standard for production apps
- Better performance at scale

#### Step 1: Update Drizzle Configuration

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

#### Step 2: Create New Schema

```typescript
// drizzle/schema.ts

import { pgTable, serial, varchar, text, timestamp, integer, boolean, jsonb, index } from 'drizzle-orm/pg-core';

// ===== EXISTING TABLES (Updated for PostgreSQL) =====

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  openId: varchar('openId', { length: 64 }).notNull().unique(),
  name: text('name'),
  email: varchar('email', { length: 320 }),
  loginMethod: varchar('loginMethod', { length: 64 }),
  role: varchar('role', { length: 20 }).default('user').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  lastSignedIn: timestamp('lastSignedIn').defaultNow().notNull(),
});

export const books = pgTable('books', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  summary: text('summary'),
  writingStyle: varchar('writingStyle', { length: 255 }),
  targetAudience: text('targetAudience'),
  // Add JSONB field for hierarchical summary
  summaryStructure: jsonb('summaryStructure'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const outlineItems = pgTable('outlineItems', {
  id: varchar('id', { length: 255 }).primaryKey(),
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  parentId: varchar('parentId', { length: 255 }),
  type: varchar('type', { length: 20 }).notNull(), // 'part', 'chapter', 'subsection', 'bullet'
  content: text('content').notNull(),
  position: integer('position').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const manuscripts = pgTable('manuscripts', {
  id: serial('id').primaryKey(),
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterId: varchar('chapterId', { length: 255 }).notNull(),
  content: text('content'),
  wordCount: integer('wordCount').default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// ===== SOURCE MATERIALS =====

export const sourceMaterials = pgTable('sourceMaterials', {
  id: serial('id').primaryKey(),
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  userId: integer('userId').notNull().references(() => users.id),
  title: text('title').notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  fileType: varchar('fileType', { length: 50 }).notNull(), // 'pdf', 'docx', 'txt', 'epub', 'library'
  fileSize: integer('fileSize').notNull(),
  storagePath: text('storagePath').notNull(), // S3 path
  processingStatus: varchar('processingStatus', { length: 50 }).default('pending').notNull(),
  // Status: 'pending', 'processing', 'completed', 'failed'
  processingError: text('processingError'),
  processedAt: timestamp('processedAt'),
  // Full extracted text (used for full-context inclusion with Opus 4.6 1M token window)
  extractedText: text('extractedText'),
  // Whether this source is active (included in AI context)
  isActive: boolean('isActive').default(true).notNull(),
  // Metadata extracted during processing
  authorName: text('authorName'),
  pageCount: integer('pageCount'),
  wordCount: integer('wordCount'),
  metadata: jsonb('metadata'), // Additional extracted metadata
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  bookIdIdx: index('sourceMaterials_bookId_idx').on(table.bookId),
  userIdIdx: index('sourceMaterials_userId_idx').on(table.userId),
  statusIdx: index('sourceMaterials_status_idx').on(table.processingStatus),
}));

// ===== CHAT SYSTEM TABLES =====

export const chatSessions = pgTable('chatSessions', {
  id: serial('id').primaryKey(),
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  userId: integer('userId').notNull().references(() => users.id),
  title: text('title'),
  isActive: boolean('isActive').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  lastMessageAt: timestamp('lastMessageAt').defaultNow().notNull(),
}, (table) => ({
  bookIdIdx: index('chatSessions_bookId_idx').on(table.bookId),
  userIdIdx: index('chatSessions_userId_idx').on(table.userId),
}));

export const chatMessages = pgTable('chatMessages', {
  id: serial('id').primaryKey(),
  sessionId: integer('sessionId').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  userId: integer('userId').notNull().references(() => users.id),
  role: varchar('role', { length: 20 }).notNull(), // 'user' or 'assistant'
  content: text('content').notNull(),
  isStarred: boolean('isStarred').default(false).notNull(),
  metadata: jsonb('metadata'), // For storing tool calls, thinking process, etc.
  createdAt: timestamp('createdAt').defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index('chatMessages_sessionId_idx').on(table.sessionId),
  bookIdIdx: index('chatMessages_bookId_idx').on(table.bookId),
  starredIdx: index('chatMessages_starred_idx').on(table.isStarred),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type Book = typeof books.$inferSelect;
export type OutlineItem = typeof outlineItems.$inferSelect;
export type Manuscript = typeof manuscripts.$inferSelect;
export type SourceMaterial = typeof sourceMaterials.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
```

#### Step 3: Generate and Run Migrations

```bash
# Generate migration SQL
pnpm drizzle-kit generate

# Review the migration file in drizzle/migrations/

# Apply migration
pnpm drizzle-kit migrate

# Verify tables were created
psql $DATABASE_URL -c "\dt"
```

### File Upload System

#### Backend: Upload Endpoint

```typescript
// server/routers.ts - Add file upload procedures

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Add to your router
files: {
  // Get presigned URL for upload
  getUploadUrl: protectedProcedure
    .input(z.object({
      bookId: z.number(),
      filename: z.string(),
      fileType: z.string(),
      fileSize: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { bookId, filename, fileType, fileSize } = input;
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/epub+zip'];
      if (!allowedTypes.includes(fileType)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid file type. Only PDF, DOCX, TXT, and EPUB files are allowed.',
        });
      }
      
      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024;
      if (fileSize > maxSize) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'File size exceeds 10MB limit.',
        });
      }
      
      // Verify user owns the book
      const book = await ctx.db.query.books.findFirst({
        where: (books, { eq, and }) => and(
          eq(books.id, bookId),
          eq(books.userId, ctx.userId)
        ),
      });
      
      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found or access denied.',
        });
      }
      
      // Generate unique file path
      const ext = filename.split('.').pop();
      const storagePath = `sources/${ctx.userId}/${bookId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      
      // Create source material record
      const sourceMaterial = await ctx.db.insert(sourceMaterials).values({
        bookId,
        userId: ctx.userId,
        title: filename.replace(/\.[^/.]+$/, ''), // Remove extension
        filename,
        fileType: ext || 'unknown',
        fileSize,
        storagePath,
        processingStatus: 'pending',
      }).returning();
      
      // Generate presigned URL for upload (valid for 5 minutes)
      const uploadUrl = await getSignedUrl(
        s3Client,
        new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: storagePath,
          ContentType: fileType,
        }),
        { expiresIn: 300 }
      );
      
      return {
        uploadUrl,
        sourceMaterialId: sourceMaterial[0].id,
        storagePath,
      };
    }),
    
  // Start processing after upload
  startProcessing: protectedProcedure
    .input(z.object({
      sourceMaterialId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const source = await ctx.db.query.sourceMaterials.findFirst({
        where: (sources, { eq, and }) => and(
          eq(sources.id, input.sourceMaterialId),
          eq(sources.userId, ctx.userId)
        ),
      });
      
      if (!source) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Source material not found.',
        });
      }
      
      // Add to processing queue (we'll implement this next)
      await addToProcessingQueue(source);
      
      return { success: true };
    }),
    
  // List sources for a book
  list: protectedProcedure
    .input(z.object({
      bookId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const sources = await ctx.db.query.sourceMaterials.findMany({
        where: (sources, { eq, and }) => and(
          eq(sources.bookId, input.bookId),
          eq(sources.userId, ctx.userId)
        ),
        orderBy: (sources, { desc }) => [desc(sources.createdAt)],
      });
      
      return sources;
    }),
    
  // Delete source material
  delete: protectedProcedure
    .input(z.object({
      sourceMaterialId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const source = await ctx.db.query.sourceMaterials.findFirst({
        where: (sources, { eq, and }) => and(
          eq(sources.id, input.sourceMaterialId),
          eq(sources.userId, ctx.userId)
        ),
      });
      
      if (!source) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Source material not found.',
        });
      }
      
      // Delete from S3
      await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: source.storagePath,
      }));
      
      // Delete from database
      await ctx.db.delete(sourceMaterials).where(eq(sourceMaterials.id, input.sourceMaterialId));
      
      return { success: true };
    }),
},
```

#### Frontend: Upload Component

```typescript
// client/src/components/sources/SourcesManager.tsx

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Upload, FileText, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface SourcesManagerProps {
  bookId: number;
}

export function SourcesManager({ bookId }: SourcesManagerProps) {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  
  const utils = trpc.useUtils();
  const { data: sources, isLoading } = trpc.files.list.useQuery({ bookId });
  const getUploadUrl = trpc.files.getUploadUrl.useMutation();
  const startProcessing = trpc.files.startProcessing.useMutation();
  const deleteMutation = trpc.files.delete.useMutation({
    onSuccess: () => {
      utils.files.list.invalidate({ bookId });
    },
  });
  
  const onDrop = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const fileId = `${file.name}-${Date.now()}`;
      setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));
      
      try {
        // Get presigned URL
        const { uploadUrl, sourceMaterialId } = await getUploadUrl.mutateAsync({
          bookId,
          filename: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
        
        // Upload to S3
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            setUploadProgress(prev => ({ ...prev, [fileId]: progress }));
          }
        });
        
        await new Promise((resolve, reject) => {
          xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
              resolve(null);
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          });
          xhr.addEventListener('error', () => reject(new Error('Upload failed')));
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.send(file);
        });
        
        // Start processing
        await startProcessing.mutateAsync({ sourceMaterialId });
        
        // Refresh list
        utils.files.list.invalidate({ bookId });
        
        // Remove from progress
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[fileId];
          return next;
        });
      } catch (error) {
        console.error('Upload error:', error);
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[fileId];
          return next;
        });
      }
    }
  };
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'application/epub+zip': ['.epub'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });
  
  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">
          {isDragActive ? 'Drop files here...' : 'Drag & drop files here, or click to select'}
        </p>
        <p className="text-xs text-muted-foreground">
          Supports PDF, DOCX, TXT, EPUB (max 10MB)
        </p>
      </div>
      
      {Object.entries(uploadProgress).map(([fileId, progress]) => (
        <Card key={fileId} className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            <div className="flex-1">
              <p className="text-sm font-medium">Uploading...</p>
              <Progress value={progress} className="mt-2" />
            </div>
          </div>
        </Card>
      ))}
      
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : sources && sources.length > 0 ? (
        <div className="space-y-2">
          {sources.map((source) => (
            <Card key={source.id} className="p-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{source.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {source.fileType.toUpperCase()} • {(source.fileSize / 1024).toFixed(0)}KB
                    {source.wordCount && ` • ${source.wordCount.toLocaleString()} words`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {source.processingStatus === 'completed' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {source.processingStatus === 'processing' && (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  )}
                  {source.processingStatus === 'failed' && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate({ sourceMaterialId: source.id })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {source.processingStatus === 'failed' && source.processingError && (
                <p className="text-xs text-red-500 mt-2">{source.processingError}</p>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          No source materials yet. Upload documents to enhance Casper's knowledge.
        </p>
      )}
    </div>
  );
}
```

### Document Processing Pipeline

#### Setup BullMQ Job Queue

```bash
# Install dependencies
pnpm add bullmq pdf-parse mammoth epub-parser
pnpm add -D @types/pdf-parse
```

```typescript
// server/queue/documentProcessor.ts
// Full-text extraction pipeline. No chunking — we leverage Claude Opus 4.6's
// 1M token context window to include complete source text in the AI prompt.

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { sourceMaterials } from '../../drizzle/schema';
import { getObject } from '../lib/s3';
import type { SourceMaterial } from '../../drizzle/schema';

// BullMQ queue and worker (only if Redis available)
const REDIS_AVAILABLE = !!(process.env.REDIS_URL || process.env.REDIS_HOST);
let documentQueue: any = null;

if (REDIS_AVAILABLE) {
  import('bullmq').then(({ Queue, Worker }) => {
    const redisConnection = process.env.REDIS_URL
      ? { url: process.env.REDIS_URL }
      : {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        };

    documentQueue = new Queue('document-processing', { connection: redisConnection });

    new Worker(
      'document-processing',
      async (job: any) => { await processDocument(job.data.sourceMaterialId); },
      { connection: redisConnection }
    );
  });
}

// Core document processing logic
async function processDocument(sourceMaterialId: number) {
  try {
    await db.update(sourceMaterials)
      .set({ processingStatus: 'processing' })
      .where(eq(sourceMaterials.id, sourceMaterialId));

    const source = await db.query.sourceMaterials.findFirst({
      where: eq(sourceMaterials.id, sourceMaterialId),
    });
    if (!source) throw new Error('Source material not found');

    // Download from S3
    const s3Object = await getObject(source.storagePath);
    const buffer = await streamToBuffer(s3Object.Body);

    // Extract text based on file type
    let extractedText = '';
    let metadata: Record<string, unknown> = {};

    switch (source.fileType.toLowerCase()) {
      case 'pdf':
        const pdfParse = (await import('pdf-parse')).default;
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text;
        metadata = { pageCount: pdfData.numpages, author: pdfData.info?.Author };
        break;
      case 'docx':
        const mammoth = await import('mammoth');
        const docxData = await mammoth.extractRawText({ buffer });
        extractedText = docxData.value;
        break;
      case 'txt':
        extractedText = buffer.toString('utf-8');
        break;
      case 'epub':
        // EPUB extraction (to be implemented with a proper parser)
        extractedText = '';
        break;
      default:
        throw new Error(`Unsupported file type: ${source.fileType}`);
    }

    const wordCount = extractedText.split(/\s+/).filter(w => w.length > 0).length;

    // Store full extracted text directly on the source material record
    await db.update(sourceMaterials)
      .set({
        processingStatus: 'completed',
        processedAt: new Date(),
        extractedText,
        wordCount,
        pageCount: (metadata.pageCount as number) || null,
        authorName: (metadata.author as string) || null,
        metadata,
      })
      .where(eq(sourceMaterials.id, sourceMaterialId));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await db.update(sourceMaterials)
      .set({ processingStatus: 'failed', processingError: errorMessage })
      .where(eq(sourceMaterials.id, sourceMaterialId));
    throw error;
  }
}

// Add job to queue (or process synchronously if no Redis)
export async function addToProcessingQueue(source: SourceMaterial) {
  if (documentQueue) {
    await documentQueue.add('process-document', { sourceMaterialId: source.id }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  } else {
    processDocument(source.id).catch(err => console.error('Sync processing failed:', err));
  }
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const readable = stream as any;
  return new Promise((resolve, reject) => {
    readable.on('data', (chunk: Buffer) => chunks.push(chunk));
    readable.on('error', reject);
    readable.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
```

### Full-Context Retrieval & Grep Search

We do NOT use RAG, chunking, or vector search. Instead, we leverage Claude Opus 4.6's
1M token context window (~750,000 words) to include full source material text directly
in the system prompt.

**Context Budget:** 600,000 words (80% of capacity). The remaining 20% is reserved for
system prompt, conversation history, and AI response. Source budget is dynamic:
`availableForSources = 600,000 - manuscriptWords - outlineWords - 3,000 (prompt overhead)`

```typescript
// server/lib/ragRetrieval.ts

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { chatMessages, sourceMaterials, manuscripts, outlineItems } from '../../drizzle/schema';

const TOTAL_CONTEXT_WORDS = 600_000;
const PROMPT_OVERHEAD_WORDS = 3_000;

// Calculate the available word budget for source materials
export function calculateContextBudget(
  manuscriptWordCount: number,
  outlineWordCount: number
): { totalBudget: number; used: number; availableForSources: number } {
  const used = manuscriptWordCount + outlineWordCount + PROMPT_OVERHEAD_WORDS;
  const availableForSources = Math.max(0, TOTAL_CONTEXT_WORDS - used);
  return { totalBudget: TOTAL_CONTEXT_WORDS, used, availableForSources };
}

// Retrieve full context for the AI prompt
export async function retrieveFullContext(bookId: number, sessionId?: number) {
  // Get manuscript and outline word counts
  const bookManuscripts = await db.query.manuscripts.findMany({
    where: eq(manuscripts.bookId, bookId),
  });
  const manuscriptWordCount = bookManuscripts.reduce((sum, m) => sum + (m.wordCount || 0), 0);

  const bookOutline = await db.query.outlineItems.findMany({
    where: eq(outlineItems.bookId, bookId),
  });
  const outlineWordCount = bookOutline.reduce(
    (sum, item) => sum + item.content.split(/\s+/).length, 0
  );

  const budget = calculateContextBudget(manuscriptWordCount, outlineWordCount);

  // Get active, completed source materials
  const activeSources = await db.query.sourceMaterials.findMany({
    where: and(
      eq(sourceMaterials.bookId, bookId),
      eq(sourceMaterials.isActive, true),
      eq(sourceMaterials.processingStatus, 'completed')
    ),
    orderBy: (sources, { asc }) => [asc(sources.createdAt)],
  });

  // Include full source text up to the budget limit
  const includedSources = [];
  let sourceWordsUsed = 0;

  for (const source of activeSources) {
    const sourceWords = source.wordCount || 0;
    if (sourceWordsUsed + sourceWords > budget.availableForSources) break;
    if (source.extractedText) {
      includedSources.push({
        title: source.title,
        authorName: source.authorName,
        wordCount: sourceWords,
        content: source.extractedText,
      });
      sourceWordsUsed += sourceWords;
    }
  }

  // Get starred messages
  const starredMessages = sessionId
    ? await db.query.chatMessages.findMany({
        where: and(eq(chatMessages.sessionId, sessionId), eq(chatMessages.isStarred, true)),
        orderBy: [desc(chatMessages.createdAt)],
        limit: 5,
      })
    : [];

  return { sources: includedSources, starredMessages, budget: { ...budget, sourceWordsUsed } };
}

// Grep-style search across all source materials for a book
export async function searchSources(bookId: number, query: string, maxResultsPerSource = 10) {
  const sources = await db.query.sourceMaterials.findMany({
    where: and(
      eq(sourceMaterials.bookId, bookId),
      eq(sourceMaterials.processingStatus, 'completed')
    ),
  });

  const results = [];
  const searchTerms = query.toLowerCase().trim();

  for (const source of sources) {
    if (!source.extractedText) continue;
    const lines = source.extractedText.split('\n');
    const matches = [];

    for (let i = 0; i < lines.length && matches.length < maxResultsPerSource; i++) {
      if (lines[i].toLowerCase().includes(searchTerms)) {
        const contextStart = Math.max(0, i - 2);
        const contextEnd = Math.min(lines.length - 1, i + 2);
        matches.push({
          line: i + 1,
          content: lines[i],
          context: lines.slice(contextStart, contextEnd + 1).join('\n'),
        });
      }
    }

    if (matches.length > 0) {
      results.push({ sourceTitle: source.title, sourceMaterialId: source.id, matches });
    }
  }

  return results;
}

// Build the context portion of the system prompt
export function buildContextPrompt(context: Awaited<ReturnType<typeof retrieveFullContext>>): string {
  let prompt = '';

  if (context.sources.length > 0) {
    prompt += '\n\n<source_materials>\n';
    prompt += 'The following source materials have been uploaded by the user. ';
    prompt += 'Use them to inform your writing and responses.\n\n';

    for (const source of context.sources) {
      prompt += `--- ${source.title}`;
      if (source.authorName) prompt += ` by ${source.authorName}`;
      prompt += ` (${source.wordCount.toLocaleString()} words) ---\n`;
      prompt += source.content + '\n\n';
    }
    prompt += '</source_materials>';
  }

  if (context.starredMessages.length > 0) {
    prompt += '\n\n<starred_insights>\n';
    prompt += 'The user has starred these important messages from previous conversations:\n\n';
    context.starredMessages.forEach((msg, i) => {
      prompt += `${i + 1}. [${msg.role}]: ${msg.content}\n\n`;
    });
    prompt += '</starred_insights>';
  }

  return prompt;
}
```

### Integration with Claude Agent

```typescript
// server/agentLoop.ts - Include full-context source materials

import { retrieveFullContext, buildContextPrompt } from './lib/ragRetrieval';

// In your agent loop, before calling Claude:
export async function processCommand(
  command: string,
  state: AgentState,
  callbacks?: AgentCallbacks
) {
  // ... existing code ...

  // Retrieve full context (all active source text + starred messages)
  const fullContext = await retrieveFullContext(
    state.bookId,
    state.sessionId
  );

  // Build system prompt with full source material text
  let systemPrompt = CASPER_SYSTEM_PROMPT;
  systemPrompt += buildContextPrompt(fullContext);

  // Continue with Claude API call using Opus 4.6's 1M token context window...
  // All active source materials are included in full — no chunking or truncation.
}
```

---

**[DOCUMENT CONTINUES IN NEXT RESPONSE DUE TO LENGTH...]**

This is part 1 of the comprehensive implementation plan. Should I continue with the remaining phases (Lexical Editor, Chat System, Summary Editor, Export, Settings, Library, Stripe, and Advanced Features)?
