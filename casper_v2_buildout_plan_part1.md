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
3. [Phase 1: Foundation & RAG System](#phase-1-foundation--rag-system-weeks-1-2)
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
- ✅ Document upload & RAG system
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
- Claude 4.5 Sonnet
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

## Phase 1: Foundation & RAG System (Weeks 1-2)

### 🎯 Goals
- Migrate from MySQL to PostgreSQL
- Add database schema for RAG system
- Implement file upload with progress tracking
- Build document processing pipeline
- Create RAG retrieval system

### Database Migration: MySQL → PostgreSQL

**Why PostgreSQL?**
- JSONB support for flexible schemas
- Better full-text search (GIN indexes)
- Vector extension support (pgvector)
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

// ===== NEW TABLES FOR RAG SYSTEM =====

export const sourceMaterials = pgTable('sourceMaterials', {
  id: serial('id').primaryKey(),
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  userId: integer('userId').notNull().references(() => users.id),
  title: text('title').notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  fileType: varchar('fileType', { length: 50 }).notNull(), // 'pdf', 'docx', 'txt', 'epub'
  fileSize: integer('fileSize').notNull(),
  storagePath: text('storagePath').notNull(), // S3 path
  processingStatus: varchar('processingStatus', { length: 50 }).default('pending').notNull(),
  // Status: 'pending', 'processing', 'completed', 'failed'
  processingError: text('processingError'),
  processedAt: timestamp('processedAt'),
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

export const documentChunks = pgTable('documentChunks', {
  id: serial('id').primaryKey(),
  sourceMaterialId: integer('sourceMaterialId').notNull().references(() => sourceMaterials.id, { onDelete: 'cascade' }),
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  userId: integer('userId').notNull().references(() => users.id),
  content: text('content').notNull(),
  chunkIndex: integer('chunkIndex').notNull(),
  chunkSize: integer('chunkSize').notNull(),
  pageNumber: integer('pageNumber'),
  sectionTitle: text('sectionTitle'),
  // For semantic search (optional - can add later with pgvector)
  // embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
}, (table) => ({
  sourceMaterialIdIdx: index('documentChunks_sourceMaterialId_idx').on(table.sourceMaterialId),
  bookIdIdx: index('documentChunks_bookId_idx').on(table.bookId),
  // Full-text search index on content
  contentSearchIdx: index('documentChunks_content_search_idx').using('gin', table.content),
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

export const bookSourceActivations = pgTable('bookSourceActivations', {
  id: serial('id').primaryKey(),
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  sourceMaterialId: integer('sourceMaterialId').notNull().references(() => sourceMaterials.id, { onDelete: 'cascade' }),
  isActive: boolean('isActive').default(true).notNull(),
  activatedAt: timestamp('activatedAt').defaultNow().notNull(),
}, (table) => ({
  bookIdIdx: index('bookSourceActivations_bookId_idx').on(table.bookId),
  uniqueActivation: index('bookSourceActivations_unique').on(table.bookId, table.sourceMaterialId),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type Book = typeof books.$inferSelect;
export type OutlineItem = typeof outlineItems.$inferSelect;
export type Manuscript = typeof manuscripts.$inferSelect;
export type SourceMaterial = typeof sourceMaterials.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type BookSourceActivation = typeof bookSourceActivations.$inferSelect;
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
      
      // Delete from database (cascades to chunks)
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

import { Queue, Worker, Job } from 'bullmq';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { db } from '../db';
import { sourceMaterials, documentChunks } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { parseEpub } from 'epub-parser';

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// Create queue
export const documentQueue = new Queue('document-processing', {
  connection: redisConnection,
});

// Create worker
export const documentWorker = new Worker(
  'document-processing',
  async (job: Job) => {
    const { sourceMaterialId } = job.data;
    
    try {
      // Update status to processing
      await db.update(sourceMaterials)
        .set({ processingStatus: 'processing' })
        .where(eq(sourceMaterials.id, sourceMaterialId));
      
      // Get source material
      const source = await db.query.sourceMaterials.findFirst({
        where: eq(sourceMaterials.id, sourceMaterialId),
      });
      
      if (!source) {
        throw new Error('Source material not found');
      }
      
      // Download from S3
      const s3Object = await s3Client.send(new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: source.storagePath,
      }));
      
      const buffer = await streamToBuffer(s3Object.Body);
      
      // Extract text based on file type
      let extractedText = '';
      let metadata: any = {};
      
      switch (source.fileType.toLowerCase()) {
        case 'pdf':
          const pdfData = await pdfParse(buffer);
          extractedText = pdfData.text;
          metadata = {
            pageCount: pdfData.numpages,
            author: pdfData.info?.Author,
            title: pdfData.info?.Title,
          };
          break;
          
        case 'docx':
          const docxData = await mammoth.extractRawText({ buffer });
          extractedText = docxData.value;
          break;
          
        case 'txt':
          extractedText = buffer.toString('utf-8');
          break;
          
        case 'epub':
          const epubData = await parseEpub(buffer);
          extractedText = epubData.sections.map(s => s.htmlString).join('\n\n');
          metadata = {
            author: epubData.author,
            title: epubData.title,
          };
          break;
          
        default:
          throw new Error(`Unsupported file type: ${source.fileType}`);
      }
      
      // Calculate word count
      const wordCount = extractedText.split(/\s+/).filter(w => w.length > 0).length;
      
      // Create chunks
      const chunks = createChunks(extractedText, 1000); // 1000 char chunks
      
      // Save chunks to database
      for (let i = 0; i < chunks.length; i++) {
        await db.insert(documentChunks).values({
          sourceMaterialId: source.id,
          bookId: source.bookId,
          userId: source.userId,
          content: chunks[i].content,
          chunkIndex: i,
          chunkSize: chunks[i].content.length,
          pageNumber: chunks[i].pageNumber,
          sectionTitle: chunks[i].sectionTitle,
        });
      }
      
      // Update source material with results
      await db.update(sourceMaterials)
        .set({
          processingStatus: 'completed',
          processedAt: new Date(),
          wordCount,
          pageCount: metadata.pageCount,
          authorName: metadata.author,
          metadata: metadata,
        })
        .where(eq(sourceMaterials.id, sourceMaterialId));
        
      return { success: true, chunks: chunks.length };
    } catch (error: any) {
      // Update status to failed
      await db.update(sourceMaterials)
        .set({
          processingStatus: 'failed',
          processingError: error.message,
        })
        .where(eq(sourceMaterials.id, sourceMaterialId));
      
      throw error;
    }
  },
  { connection: redisConnection }
);

// Helper function to create intelligent chunks
function createChunks(text: string, maxChunkSize: number): Array<{
  content: string;
  pageNumber?: number;
  sectionTitle?: string;
}> {
  const chunks: Array<{ content: string; pageNumber?: number; sectionTitle?: string }> = [];
  
  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  let chunkCount = 0;
  
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    
    // If adding this paragraph would exceed max size, save current chunk
    if (currentChunk.length + trimmed.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
      });
      currentChunk = '';
      chunkCount++;
    }
    
    // If single paragraph is larger than max size, split it
    if (trimmed.length > maxChunkSize) {
      const sentences = trimmed.split(/[.!?]+\s+/);
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
          chunks.push({
            content: currentChunk.trim(),
          });
          currentChunk = '';
          chunkCount++;
        }
        currentChunk += sentence + '. ';
      }
    } else {
      currentChunk += trimmed + '\n\n';
    }
  }
  
  // Add final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
    });
  }
  
  return chunks;
}

// Helper to convert stream to buffer
async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: any[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: any) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Add job to queue
export async function addToProcessingQueue(source: any) {
  await documentQueue.add('process-document', {
    sourceMaterialId: source.id,
  });
}
```

### RAG Retrieval System

```typescript
// server/lib/ragRetrieval.ts

import { db } from '../db';
import { documentChunks, chatMessages, bookSourceActivations } from '../../drizzle/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

interface RetrievalContext {
  documentChunks: Array<{
    content: string;
    source: string;
    pageNumber?: number;
  }>;
  starredMessages: Array<{
    content: string;
    createdAt: Date;
  }>;
}

export async function retrieveContext(
  bookId: number,
  userQuery: string,
  sessionId?: number
): Promise<RetrievalContext> {
  // Extract keywords from query
  const keywords = extractKeywords(userQuery);
  
  // Get active source materials for this book
  const activeSources = await db.query.bookSourceActivations.findMany({
    where: and(
      eq(bookSourceActivations.bookId, bookId),
      eq(bookSourceActivations.isActive, true)
    ),
    with: {
      sourceMaterial: true,
    },
  });
  
  const activeSourceIds = activeSources.map(as => as.sourceMaterialId);
  
  // Retrieve relevant document chunks using keyword matching
  const chunks = await db.query.documentChunks.findMany({
    where: and(
      eq(documentChunks.bookId, bookId),
      // Filter by active sources
      activeSourceIds.length > 0 
        ? sql`${documentChunks.sourceMaterialId} IN (${activeSourceIds.join(',')})`
        : sql`1=1`
    ),
    limit: 50, // Get top 50 chunks initially
  });
  
  // Score chunks by keyword relevance
  const scoredChunks = chunks.map(chunk => {
    let score = 0;
    const content = chunk.content.toLowerCase();
    
    for (const keyword of keywords) {
      const occurrences = (content.match(new RegExp(keyword, 'gi')) || []).length;
      score += occurrences * keyword.length; // Weight by keyword length
    }
    
    return { ...chunk, score };
  });
  
  // Sort by score and take top 10
  const topChunks = scoredChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .filter(chunk => chunk.score > 0); // Only include chunks with matches
  
  // Get starred chat messages
  const starredMessages = sessionId 
    ? await db.query.chatMessages.findMany({
        where: and(
          eq(chatMessages.sessionId, sessionId),
          eq(chatMessages.isStarred, true)
        ),
        orderBy: [desc(chatMessages.createdAt)],
        limit: 5,
      })
    : [];
  
  return {
    documentChunks: topChunks.map(chunk => ({
      content: chunk.content,
      source: `Source ${chunk.sourceMaterialId}`,
      pageNumber: chunk.pageNumber || undefined,
    })),
    starredMessages: starredMessages.map(msg => ({
      content: msg.content,
      createdAt: msg.createdAt,
    })),
  };
}

function extractKeywords(query: string): string[] {
  // Remove common stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'it', 'this', 'that', 'these',
    'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who',
    'when', 'where', 'why', 'how'
  ]);
  
  // Extract words, filter stop words, and lowercase
  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  // Remove duplicates
  return Array.from(new Set(words));
}
```

### Integration with Claude Agent

```typescript
// server/agentLoop.ts - Update to include RAG context

import { retrieveContext } from './lib/ragRetrieval';

// In your agent loop, before calling Claude:
export async function processCommand(
  command: string,
  state: AgentState,
  callbacks?: AgentCallbacks
) {
  // ... existing code ...
  
  // Retrieve RAG context
  const ragContext = await retrieveContext(
    state.bookId,
    command,
    state.sessionId
  );
  
  // Build system prompt with RAG context
  let systemPrompt = CASPER_SYSTEM_PROMPT;
  
  // Add document context
  if (ragContext.documentChunks.length > 0) {
    systemPrompt += '\n\n<source_materials>\n';
    systemPrompt += 'The user has uploaded the following source materials that may be relevant:\n\n';
    
    ragContext.documentChunks.forEach((chunk, i) => {
      systemPrompt += `Source ${i + 1} (${chunk.source}):\n`;
      systemPrompt += chunk.content.substring(0, 500) + '...\n\n';
    });
    
    systemPrompt += '</source_materials>';
  }
  
  // Add starred messages
  if (ragContext.starredMessages.length > 0) {
    systemPrompt += '\n\n<starred_insights>\n';
    systemPrompt += 'The user has starred these important exchanges:\n\n';
    
    ragContext.starredMessages.forEach((msg, i) => {
      systemPrompt += `${i + 1}. ${msg.content}\n\n`;
    });
    
    systemPrompt += '</starred_insights>';
  }
  
  // Continue with Claude API call...
}
```

---

**[DOCUMENT CONTINUES IN NEXT RESPONSE DUE TO LENGTH...]**

This is part 1 of the comprehensive implementation plan. Should I continue with the remaining phases (Lexical Editor, Chat System, Summary Editor, Export, Settings, Library, Stripe, and Advanced Features)?
