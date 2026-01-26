import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { eq } from 'drizzle-orm';
import { users, profiles } from '../../drizzle/schema';
import { signToken } from '../lib/auth';

export const authRouter = router({
  // Register new user
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        openId: z.string(), // From OAuth provider
        loginMethod: z.string().default('email'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if user already exists
      const existing = await ctx.db.query.users.findFirst({
        where: eq(users.openId, input.openId),
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User already exists',
        });
      }

      // Create user
      const [user] = await ctx.db
        .insert(users)
        .values({
          openId: input.openId,
          email: input.email,
          name: input.name || null,
          loginMethod: input.loginMethod,
          role: 'user',
        })
        .returning();

      // Create default profile
      await ctx.db.insert(profiles).values({
        userId: user.id,
      });

      // Generate token
      const token = await signToken({
        userId: user.id,
        openId: user.openId,
        email: user.email || undefined,
        role: user.role,
      });

      return { user, token };
    }),

  // Login existing user
  login: publicProcedure
    .input(
      z.object({
        openId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.openId, input.openId),
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Update last signed in
      await ctx.db
        .update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      // Generate token
      const token = await signToken({
        userId: user.id,
        openId: user.openId,
        email: user.email || undefined,
        role: user.role,
      });

      return { user, token };
    }),

  // Get current user
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.userId),
      with: {
        profile: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return user;
  }),

  // Update profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        bio: z.string().optional(),
        penName: z.string().optional(),
        profilePicture: z.string().optional(),
        theme: z.enum(['light', 'dark', 'system']).optional(),
        fontSize: z.enum(['small', 'medium', 'large']).optional(),
        editorMode: z.enum(['rich', 'markdown']).optional(),
        autoSaveInterval: z.number().min(500).max(10000).optional(),
        modelPreference: z.string().optional(),
        temperature: z.number().min(0).max(10).optional(),
        maxTokens: z.number().min(100).max(100000).optional(),
        extendedThinking: z.boolean().optional(),
        emailNotifications: z.boolean().optional(),
        exportNotifications: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if profile exists
      const existing = await ctx.db.query.profiles.findFirst({
        where: eq(profiles.userId, ctx.userId),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(profiles)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(profiles.userId, ctx.userId))
          .returning();
        return updated;
      } else {
        const [created] = await ctx.db
          .insert(profiles)
          .values({
            userId: ctx.userId,
            ...input,
          })
          .returning();
        return created;
      }
    }),

  // Get profile
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.query.profiles.findFirst({
      where: eq(profiles.userId, ctx.userId),
    });

    return profile;
  }),

  // Logout (client-side token removal)
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    // Clear cookie if using cookies
    ctx.res.clearCookie('token');
    return { success: true };
  }),
});
