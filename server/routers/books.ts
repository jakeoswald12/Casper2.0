import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { eq, and, asc, desc } from 'drizzle-orm';
import {
  books,
  outlineItems,
  manuscripts,
  NewBook,
  NewOutlineItem,
} from '../../drizzle/schema';

// Summary item type
interface SummaryItem {
  id: string;
  type: 'section' | 'item';
  title: string;
  content: string;
  children?: SummaryItem[];
  position: number;
}

// Default summary structure
const DEFAULT_SUMMARY: SummaryItem[] = [
  {
    id: 'overview',
    type: 'section',
    title: 'Overview',
    content: '',
    position: 0,
    children: [],
  },
  {
    id: 'audience',
    type: 'section',
    title: 'Target Audience',
    content: '',
    position: 1,
    children: [],
  },
  {
    id: 'tone',
    type: 'section',
    title: 'Tone & Style',
    content: '',
    position: 2,
    children: [],
  },
  {
    id: 'context',
    type: 'section',
    title: 'Context & Setting',
    content: '',
    position: 3,
    children: [],
  },
  {
    id: 'characters',
    type: 'section',
    title: 'Characters',
    content: '',
    position: 4,
    children: [],
  },
];

export const booksRouter = router({
  // Create a new book
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        subtitle: z.string().optional(),
        writingStyle: z.string().optional(),
        targetAudience: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const bookData: NewBook = {
        userId: ctx.userId,
        title: input.title,
        subtitle: input.subtitle || null,
        writingStyle: input.writingStyle || null,
        targetAudience: input.targetAudience || null,
        summaryStructure: DEFAULT_SUMMARY,
      };

      const [book] = await ctx.db.insert(books).values(bookData).returning();

      return book;
    }),

  // Get all books for user
  list: protectedProcedure.query(async ({ ctx }) => {
    const userBooks = await ctx.db.query.books.findMany({
      where: eq(books.userId, ctx.userId),
      orderBy: [desc(books.updatedAt)],
    });

    return userBooks;
  }),

  // Get single book with outline
  get: protectedProcedure
    .input(z.object({ bookId: z.number() }))
    .query(async ({ input, ctx }) => {
      const book = await ctx.db.query.books.findFirst({
        where: and(eq(books.id, input.bookId), eq(books.userId, ctx.userId)),
        with: {
          outlineItems: {
            orderBy: [asc(outlineItems.position)],
          },
        },
      });

      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }

      return book;
    }),

  // Update book
  update: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
        title: z.string().min(1).max(255).optional(),
        subtitle: z.string().optional(),
        summary: z.string().optional(),
        writingStyle: z.string().optional(),
        targetAudience: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { bookId, ...updates } = input;

      const [updated] = await ctx.db
        .update(books)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(books.id, bookId), eq(books.userId, ctx.userId)))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }

      return updated;
    }),

  // Delete book
  delete: protectedProcedure
    .input(z.object({ bookId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db
        .delete(books)
        .where(and(eq(books.id, input.bookId), eq(books.userId, ctx.userId)));

      return { success: true };
    }),

  // Get summary structure
  getSummary: protectedProcedure
    .input(z.object({ bookId: z.number() }))
    .query(async ({ input, ctx }) => {
      const book = await ctx.db.query.books.findFirst({
        where: and(eq(books.id, input.bookId), eq(books.userId, ctx.userId)),
      });

      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }

      return (book.summaryStructure as SummaryItem[]) || DEFAULT_SUMMARY;
    }),

  // Update summary structure
  updateSummary: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
        summaryStructure: z.any(), // SummaryItem[]
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.db
        .update(books)
        .set({
          summaryStructure: input.summaryStructure,
          updatedAt: new Date(),
        })
        .where(and(eq(books.id, input.bookId), eq(books.userId, ctx.userId)));

      return { success: true };
    }),

  // ===== OUTLINE OPERATIONS =====

  // Add outline item
  addOutlineItem: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
        parentId: z.string().optional(),
        type: z.enum(['part', 'chapter', 'subsection', 'bullet']),
        content: z.string(),
        position: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const book = await ctx.db.query.books.findFirst({
        where: and(eq(books.id, input.bookId), eq(books.userId, ctx.userId)),
      });

      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }

      const id = `${input.type}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const itemData: NewOutlineItem = {
        id,
        bookId: input.bookId,
        parentId: input.parentId || null,
        type: input.type,
        content: input.content,
        position: input.position,
      };

      const [item] = await ctx.db
        .insert(outlineItems)
        .values(itemData)
        .returning();

      // Update book timestamp
      await ctx.db
        .update(books)
        .set({ updatedAt: new Date() })
        .where(eq(books.id, input.bookId));

      return item;
    }),

  // Update outline item
  updateOutlineItem: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        bookId: z.number(),
        content: z.string().optional(),
        position: z.number().optional(),
        parentId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, bookId, ...updates } = input;

      // Verify ownership
      const book = await ctx.db.query.books.findFirst({
        where: and(eq(books.id, bookId), eq(books.userId, ctx.userId)),
      });

      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }

      const [updated] = await ctx.db
        .update(outlineItems)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(outlineItems.id, id), eq(outlineItems.bookId, bookId)))
        .returning();

      return updated;
    }),

  // Delete outline item
  deleteOutlineItem: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        bookId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const book = await ctx.db.query.books.findFirst({
        where: and(eq(books.id, input.bookId), eq(books.userId, ctx.userId)),
      });

      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }

      await ctx.db
        .delete(outlineItems)
        .where(
          and(
            eq(outlineItems.id, input.id),
            eq(outlineItems.bookId, input.bookId)
          )
        );

      return { success: true };
    }),

  // ===== MANUSCRIPT OPERATIONS =====

  // Get manuscript for a chapter
  getManuscript: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
        chapterId: z.string(),
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
          message: 'Book not found',
        });
      }

      const manuscript = await ctx.db.query.manuscripts.findFirst({
        where: and(
          eq(manuscripts.bookId, input.bookId),
          eq(manuscripts.chapterId, input.chapterId)
        ),
      });

      return manuscript || null;
    }),

  // Update manuscript
  updateManuscript: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
        chapterId: z.string(),
        content: z.string(),
        wordCount: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const book = await ctx.db.query.books.findFirst({
        where: and(eq(books.id, input.bookId), eq(books.userId, ctx.userId)),
      });

      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }

      // Check if manuscript exists
      const existing = await ctx.db.query.manuscripts.findFirst({
        where: and(
          eq(manuscripts.bookId, input.bookId),
          eq(manuscripts.chapterId, input.chapterId)
        ),
      });

      const wordCount =
        input.wordCount ??
        input.content.split(/\s+/).filter((w) => w.length > 0).length;

      if (existing) {
        const [updated] = await ctx.db
          .update(manuscripts)
          .set({
            content: input.content,
            wordCount,
            updatedAt: new Date(),
          })
          .where(eq(manuscripts.id, existing.id))
          .returning();

        return updated;
      } else {
        const [created] = await ctx.db
          .insert(manuscripts)
          .values({
            bookId: input.bookId,
            chapterId: input.chapterId,
            content: input.content,
            wordCount,
          })
          .returning();

        return created;
      }
    }),
});
