import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { eq, and, or, desc, sql, asc } from 'drizzle-orm';
import {
  libraryBooks,
  libraryBookChapters,
  books,
  outlineItems,
  manuscripts,
  sourceMaterials,
} from '../../drizzle/schema';

export const libraryRouter = router({
  // Browse public library
  browse: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        genre: z.string().optional(),
        limit: z.number().default(20),
        offset: z.number().default(0),
        sortBy: z.enum(['recent', 'popular', 'title']).default('recent'),
      })
    )
    .query(async ({ input, ctx }) => {
      const { search, genre, limit, offset, sortBy } = input;

      // Build conditions
      const conditions = [eq(libraryBooks.isPublic, true)];

      if (genre) {
        conditions.push(eq(libraryBooks.genre, genre));
      }

      // Build the query based on conditions and search
      let baseQuery = ctx.db
        .select({
          id: libraryBooks.id,
          title: libraryBooks.title,
          author: libraryBooks.author,
          description: libraryBooks.description,
          coverImage: libraryBooks.coverImage,
          genre: libraryBooks.genre,
          viewCount: libraryBooks.viewCount,
          publishedAt: libraryBooks.publishedAt,
        })
        .from(libraryBooks)
        .where(and(...conditions));

      // Add search filter if provided
      if (search) {
        baseQuery = ctx.db
          .select({
            id: libraryBooks.id,
            title: libraryBooks.title,
            author: libraryBooks.author,
            description: libraryBooks.description,
            coverImage: libraryBooks.coverImage,
            genre: libraryBooks.genre,
            viewCount: libraryBooks.viewCount,
            publishedAt: libraryBooks.publishedAt,
          })
          .from(libraryBooks)
          .where(
            and(
              ...conditions,
              or(
                sql`${libraryBooks.title} ILIKE ${`%${search}%`}`,
                sql`${libraryBooks.author} ILIKE ${`%${search}%`}`
              )
            )
          );
      }

      // Apply sorting
      let sortedQuery;
      switch (sortBy) {
        case 'popular':
          sortedQuery = baseQuery.orderBy(desc(libraryBooks.viewCount));
          break;
        case 'title':
          sortedQuery = baseQuery.orderBy(asc(libraryBooks.title));
          break;
        case 'recent':
        default:
          sortedQuery = baseQuery.orderBy(desc(libraryBooks.publishedAt));
      }

      const results = await sortedQuery.limit(limit).offset(offset);

      // Get total count for pagination
      const countResult = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(libraryBooks)
        .where(eq(libraryBooks.isPublic, true));

      return {
        books: results,
        total: Number(countResult[0]?.count || 0),
        hasMore: offset + results.length < Number(countResult[0]?.count || 0),
      };
    }),

  // Get available genres
  getGenres: publicProcedure.query(async ({ ctx }) => {
    const genres = await ctx.db
      .selectDistinct({ genre: libraryBooks.genre })
      .from(libraryBooks)
      .where(
        and(eq(libraryBooks.isPublic, true), sql`${libraryBooks.genre} IS NOT NULL`)
      );

    return genres.map((g) => g.genre).filter(Boolean) as string[];
  }),

  // Get book details
  getBook: publicProcedure
    .input(z.object({ bookId: z.number() }))
    .query(async ({ input, ctx }) => {
      const book = await ctx.db.query.libraryBooks.findFirst({
        where: eq(libraryBooks.id, input.bookId),
        with: {
          chapters: {
            orderBy: [asc(libraryBookChapters.chapterNumber)],
          },
        },
      });

      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }

      // Only show public books or books owned by the user
      if (!book.isPublic && ctx.user?.userId !== book.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      // Increment view count
      await ctx.db
        .update(libraryBooks)
        .set({ viewCount: sql`${libraryBooks.viewCount} + 1` })
        .where(eq(libraryBooks.id, input.bookId));

      return book;
    }),

  // Publish a book to the library
  publish: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
        title: z.string().min(1),
        author: z.string().min(1),
        description: z.string().optional(),
        genre: z.string().optional(),
        isbn: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        coverImage: z.string().optional(),
        isPublic: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { bookId, ...publishData } = input;

      // Get book and verify ownership
      const book = await ctx.db.query.books.findFirst({
        where: and(eq(books.id, bookId), eq(books.userId, ctx.userId)),
      });

      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }

      // Check if already published
      const existingPublication = await ctx.db.query.libraryBooks.findFirst({
        where: and(
          eq(libraryBooks.sourceBookId, bookId),
          eq(libraryBooks.userId, ctx.userId)
        ),
      });

      if (existingPublication) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This book has already been published to the library',
        });
      }

      // Get outline (chapters)
      const outline = await ctx.db.query.outlineItems.findMany({
        where: eq(outlineItems.bookId, bookId),
        orderBy: [asc(outlineItems.position)],
      });

      // Get manuscripts
      const bookManuscripts = await ctx.db.query.manuscripts.findMany({
        where: eq(manuscripts.bookId, bookId),
      });

      // Create library book
      const [libraryBook] = await ctx.db
        .insert(libraryBooks)
        .values({
          userId: ctx.userId,
          sourceBookId: bookId,
          ...publishData,
        })
        .returning();

      // Process chapters
      const chapters = outline
        .filter((item) => item.type === 'chapter')
        .map((chapter, index) => {
          const manuscript = bookManuscripts.find((m) => m.chapterId === chapter.id);
          return {
            libraryBookId: libraryBook.id,
            chapterNumber: index + 1,
            title: chapter.content,
            content: manuscript?.content || '',
            wordCount: manuscript?.wordCount || 0,
          };
        });

      if (chapters.length > 0) {
        await ctx.db.insert(libraryBookChapters).values(chapters);
      }

      return libraryBook;
    }),

  // Unpublish a book
  unpublish: protectedProcedure
    .input(z.object({ libraryBookId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const libraryBook = await ctx.db.query.libraryBooks.findFirst({
        where: and(
          eq(libraryBooks.id, input.libraryBookId),
          eq(libraryBooks.userId, ctx.userId)
        ),
      });

      if (!libraryBook) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Library book not found',
        });
      }

      // Delete the library book (cascades to chapters)
      await ctx.db
        .delete(libraryBooks)
        .where(eq(libraryBooks.id, input.libraryBookId));

      return { success: true };
    }),

  // Add library book as source to a project
  addToProject: protectedProcedure
    .input(
      z.object({
        libraryBookId: z.number(),
        bookId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify ownership of target book
      const targetBook = await ctx.db.query.books.findFirst({
        where: and(eq(books.id, input.bookId), eq(books.userId, ctx.userId)),
      });

      if (!targetBook) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Target book not found',
        });
      }

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

      // Check if not public and not owned
      if (!libraryBook.isPublic && libraryBook.userId !== ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
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
      await ctx.db
        .insert(sourceMaterials)
        .values({
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

  // Get user's published books
  getMyPublications: protectedProcedure.query(async ({ ctx }) => {
    const publications = await ctx.db.query.libraryBooks.findMany({
      where: eq(libraryBooks.userId, ctx.userId),
      orderBy: [desc(libraryBooks.publishedAt)],
    });

    return publications;
  }),
});
