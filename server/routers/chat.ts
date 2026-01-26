import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { eq, and, desc } from 'drizzle-orm';
import { chatSessions, chatMessages, books } from '../../drizzle/schema';

export const chatRouter = router({
  // Create new chat session
  createSession: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify book ownership
      const book = await ctx.db.query.books.findFirst({
        where: and(eq(books.id, input.bookId), eq(books.userId, ctx.userId)),
      });

      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }

      const [session] = await ctx.db
        .insert(chatSessions)
        .values({
          bookId: input.bookId,
          userId: ctx.userId,
          title: input.title || 'New Chat',
          isActive: true,
        })
        .returning();

      return session;
    }),

  // Get sessions for a book
  getSessions: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await ctx.db.query.chatSessions.findMany({
        where: and(
          eq(chatSessions.bookId, input.bookId),
          eq(chatSessions.userId, ctx.userId)
        ),
        orderBy: [desc(chatSessions.lastMessageAt)],
      });
    }),

  // Get messages for a session
  getMessages: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verify session ownership
      const session = await ctx.db.query.chatSessions.findFirst({
        where: and(
          eq(chatSessions.id, input.sessionId),
          eq(chatSessions.userId, ctx.userId)
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat session not found',
        });
      }

      const messages = await ctx.db.query.chatMessages.findMany({
        where: eq(chatMessages.sessionId, input.sessionId),
        orderBy: [desc(chatMessages.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      // Return oldest first
      return messages.reverse();
    }),

  // Save message
  saveMessage: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
        bookId: z.number(),
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        metadata: z.any().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify session ownership
      const session = await ctx.db.query.chatSessions.findFirst({
        where: and(
          eq(chatSessions.id, input.sessionId),
          eq(chatSessions.userId, ctx.userId)
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat session not found',
        });
      }

      const [message] = await ctx.db
        .insert(chatMessages)
        .values({
          sessionId: input.sessionId,
          bookId: input.bookId,
          userId: ctx.userId,
          role: input.role,
          content: input.content,
          metadata: input.metadata || null,
          isStarred: false,
        })
        .returning();

      // Update session's last message time
      await ctx.db
        .update(chatSessions)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(chatSessions.id, input.sessionId));

      return message;
    }),

  // Toggle message star
  toggleStar: protectedProcedure
    .input(
      z.object({
        messageId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const message = await ctx.db.query.chatMessages.findFirst({
        where: and(
          eq(chatMessages.id, input.messageId),
          eq(chatMessages.userId, ctx.userId)
        ),
      });

      if (!message) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Message not found',
        });
      }

      await ctx.db
        .update(chatMessages)
        .set({ isStarred: !message.isStarred })
        .where(eq(chatMessages.id, input.messageId));

      return { isStarred: !message.isStarred };
    }),

  // Delete session
  deleteSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.db
        .delete(chatSessions)
        .where(
          and(
            eq(chatSessions.id, input.sessionId),
            eq(chatSessions.userId, ctx.userId)
          )
        );

      return { success: true };
    }),

  // Rename session
  renameSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
        title: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.db
        .update(chatSessions)
        .set({ title: input.title, updatedAt: new Date() })
        .where(
          and(
            eq(chatSessions.id, input.sessionId),
            eq(chatSessions.userId, ctx.userId)
          )
        );

      return { success: true };
    }),

  // Get starred messages for a book
  getStarredMessages: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const messages = await ctx.db.query.chatMessages.findMany({
        where: and(
          eq(chatMessages.bookId, input.bookId),
          eq(chatMessages.userId, ctx.userId),
          eq(chatMessages.isStarred, true)
        ),
        orderBy: [desc(chatMessages.createdAt)],
        limit: input.limit,
      });

      return messages;
    }),
});
