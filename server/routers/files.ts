import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { eq, and } from 'drizzle-orm';
import {
  sourceMaterials,
  books,
  manuscripts,
  outlineItems,
} from '../../drizzle/schema';
import {
  getUploadPresignedUrl,
  deleteObject,
  generateStoragePath,
} from '../lib/s3';
import { addToProcessingQueue } from '../queue/documentProcessor';
import { calculateContextBudget } from '../lib/ragRetrieval';

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/epub+zip',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const filesRouter = router({
  // Get presigned URL for upload
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
        filename: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { bookId, filename, fileType, fileSize } = input;

      // Validate file type
      if (!ALLOWED_FILE_TYPES.includes(fileType)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Invalid file type. Only PDF, DOCX, TXT, and EPUB files are allowed.',
        });
      }

      // Validate file size
      if (fileSize > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'File size exceeds 10MB limit.',
        });
      }

      // Verify user owns the book
      const book = await ctx.db.query.books.findFirst({
        where: and(eq(books.id, bookId), eq(books.userId, ctx.userId)),
      });

      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found or access denied.',
        });
      }

      // Generate unique file path
      const storagePath = generateStoragePath(ctx.userId, bookId, filename);

      // Create source material record (active by default)
      const ext = filename.split('.').pop() || 'bin';
      const [sourceMaterial] = await ctx.db
        .insert(sourceMaterials)
        .values({
          bookId,
          userId: ctx.userId,
          title: filename.replace(/\.[^/.]+$/, ''), // Remove extension
          filename,
          fileType: ext,
          fileSize,
          storagePath,
          processingStatus: 'pending',
          isActive: true,
        })
        .returning();

      // Generate presigned URL for upload (valid for 5 minutes)
      const uploadUrl = await getUploadPresignedUrl(storagePath, fileType, 300);

      return {
        uploadUrl,
        sourceMaterialId: sourceMaterial.id,
        storagePath,
      };
    }),

  // Start processing after upload
  startProcessing: protectedProcedure
    .input(
      z.object({
        sourceMaterialId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const source = await ctx.db.query.sourceMaterials.findFirst({
        where: and(
          eq(sourceMaterials.id, input.sourceMaterialId),
          eq(sourceMaterials.userId, ctx.userId)
        ),
      });

      if (!source) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Source material not found.',
        });
      }

      // Add to processing queue
      await addToProcessingQueue(source);

      return { success: true };
    }),

  // List sources for a book
  list: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const sources = await ctx.db.query.sourceMaterials.findMany({
        where: and(
          eq(sourceMaterials.bookId, input.bookId),
          eq(sourceMaterials.userId, ctx.userId)
        ),
        orderBy: (sources, { desc }) => [desc(sources.createdAt)],
      });

      // Return without extractedText to avoid sending huge payloads to the client
      return sources.map(({ extractedText, ...rest }) => rest);
    }),

  // Get single source (without full text)
  get: protectedProcedure
    .input(
      z.object({
        sourceMaterialId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const source = await ctx.db.query.sourceMaterials.findFirst({
        where: and(
          eq(sourceMaterials.id, input.sourceMaterialId),
          eq(sourceMaterials.userId, ctx.userId)
        ),
      });

      if (!source) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Source material not found.',
        });
      }

      const { extractedText, ...rest } = source;
      return rest;
    }),

  // Toggle source activation (whether it's included in AI context)
  toggleActivation: protectedProcedure
    .input(
      z.object({
        sourceMaterialId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const source = await ctx.db.query.sourceMaterials.findFirst({
        where: and(
          eq(sourceMaterials.id, input.sourceMaterialId),
          eq(sourceMaterials.userId, ctx.userId)
        ),
      });

      if (!source) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Source material not found.',
        });
      }

      await ctx.db
        .update(sourceMaterials)
        .set({ isActive: !source.isActive })
        .where(eq(sourceMaterials.id, input.sourceMaterialId));

      return { isActive: !source.isActive };
    }),

  // Delete source material
  delete: protectedProcedure
    .input(
      z.object({
        sourceMaterialId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const source = await ctx.db.query.sourceMaterials.findFirst({
        where: and(
          eq(sourceMaterials.id, input.sourceMaterialId),
          eq(sourceMaterials.userId, ctx.userId)
        ),
      });

      if (!source) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Source material not found.',
        });
      }

      // Delete from S3 if it has a storage path
      if (source.storagePath) {
        try {
          await deleteObject(source.storagePath);
        } catch (error) {
          console.error('Failed to delete S3 object:', error);
        }
      }

      // Delete from database
      await ctx.db
        .delete(sourceMaterials)
        .where(eq(sourceMaterials.id, input.sourceMaterialId));

      return { success: true };
    }),

  // Get context budget for a book
  // Shows how much of the 600K word budget is used by manuscript/outline/sources
  getContextBudget: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verify ownership
      const book = await ctx.db.query.books.findFirst({
        where: and(eq(books.id, input.bookId), eq(books.userId, ctx.userId)),
      });

      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found.',
        });
      }

      // Get manuscript word count
      const bookManuscripts = await ctx.db.query.manuscripts.findMany({
        where: eq(manuscripts.bookId, input.bookId),
      });
      const manuscriptWordCount = bookManuscripts.reduce(
        (sum, m) => sum + (m.wordCount || 0),
        0
      );

      // Get outline word count
      const bookOutline = await ctx.db.query.outlineItems.findMany({
        where: eq(outlineItems.bookId, input.bookId),
      });
      const outlineWordCount = bookOutline.reduce(
        (sum, item) => sum + item.content.split(/\s+/).length,
        0
      );

      // Calculate budget
      const budget = calculateContextBudget(manuscriptWordCount, outlineWordCount);

      // Get source material word counts
      const sources = await ctx.db.query.sourceMaterials.findMany({
        where: and(
          eq(sourceMaterials.bookId, input.bookId),
          eq(sourceMaterials.userId, ctx.userId)
        ),
      });

      const activeSourceWords = sources
        .filter((s) => s.isActive && s.processingStatus === 'completed')
        .reduce((sum, s) => sum + (s.wordCount || 0), 0);

      const totalSourceWords = sources
        .filter((s) => s.processingStatus === 'completed')
        .reduce((sum, s) => sum + (s.wordCount || 0), 0);

      return {
        totalBudget: budget.totalBudget,
        manuscriptWords: manuscriptWordCount,
        outlineWords: outlineWordCount,
        promptOverhead: 3_000,
        availableForSources: budget.availableForSources,
        activeSourceWords,
        totalSourceWords,
        budgetUsedPercent: Math.round(
          ((manuscriptWordCount + outlineWordCount + 3_000 + activeSourceWords) /
            budget.totalBudget) *
            100
        ),
      };
    }),

  // Search across source materials (grep-style)
  search: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
        query: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verify ownership
      const book = await ctx.db.query.books.findFirst({
        where: and(eq(books.id, input.bookId), eq(books.userId, ctx.userId)),
      });

      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found.',
        });
      }

      // Import and use searchSources
      const { searchSources } = await import('../lib/ragRetrieval');
      return searchSources(input.bookId, input.query);
    }),
});
