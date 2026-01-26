import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { eq, and } from 'drizzle-orm';
import {
  sourceMaterials,
  books,
  bookSourceActivations,
} from '../../drizzle/schema';
import {
  getUploadPresignedUrl,
  deleteObject,
  generateStoragePath,
} from '../lib/s3';
import { addToProcessingQueue } from '../queue/documentProcessor';

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
      const ext = filename.split('.').pop() || 'bin';
      const storagePath = generateStoragePath(ctx.userId, bookId, filename);

      // Create source material record
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

      // Create activation entry (active by default)
      await ctx.db.insert(bookSourceActivations).values({
        bookId: source.bookId,
        sourceMaterialId: source.id,
        isActive: true,
      });

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

      return sources;
    }),

  // Get single source
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

      return source;
    }),

  // Toggle source activation
  toggleActivation: protectedProcedure
    .input(
      z.object({
        sourceMaterialId: z.number(),
        bookId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const activation = await ctx.db.query.bookSourceActivations.findFirst({
        where: and(
          eq(bookSourceActivations.sourceMaterialId, input.sourceMaterialId),
          eq(bookSourceActivations.bookId, input.bookId)
        ),
      });

      if (!activation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Source activation not found.',
        });
      }

      await ctx.db
        .update(bookSourceActivations)
        .set({ isActive: !activation.isActive })
        .where(eq(bookSourceActivations.id, activation.id));

      return { isActive: !activation.isActive };
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

      // Delete from database (cascades to chunks and activations)
      await ctx.db
        .delete(sourceMaterials)
        .where(eq(sourceMaterials.id, input.sourceMaterialId));

      return { success: true };
    }),
});
