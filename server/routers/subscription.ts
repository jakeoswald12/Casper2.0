import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { eq, and, sql, gte } from 'drizzle-orm';
import { subscriptions, usageTracking, users } from '../../drizzle/schema';
import {
  PLANS,
  PlanType,
  createCheckoutSession,
  createCustomerPortalSession,
  cancelSubscription,
  reactivateSubscription,
  formatPrice,
} from '../lib/stripe';

export const subscriptionRouter = router({
  // Get current subscription status
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await ctx.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, ctx.userId),
    });

    if (!subscription) {
      return {
        plan: 'free' as PlanType,
        status: 'active',
        limits: PLANS.free.limits,
        features: PLANS.free.features,
        subscription: null,
      };
    }

    const plan = subscription.plan as PlanType;

    return {
      plan,
      status: subscription.status,
      limits: PLANS[plan]?.limits || PLANS.free.limits,
      features: PLANS[plan]?.features || PLANS.free.features,
      subscription: {
        id: subscription.id,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
    };
  }),

  // Get available plans
  getPlans: protectedProcedure.query(async () => {
    return Object.entries(PLANS).map(([key, plan]) => ({
      id: key as PlanType,
      name: plan.name,
      price: plan.price,
      priceFormatted: formatPrice(plan.price),
      features: plan.features,
      limits: plan.limits,
    }));
  }),

  // Create checkout session for upgrade
  createCheckout: protectedProcedure
    .input(
      z.object({
        plan: z.enum(['pro', 'enterprise']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get user email
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.userId),
      });

      if (!user?.email) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User email is required for subscription',
        });
      }

      // Check if user already has an active subscription to the same or higher plan
      const existingSubscription = await ctx.db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.userId, ctx.userId),
          eq(subscriptions.status, 'active')
        ),
      });

      if (existingSubscription) {
        const currentPlan = existingSubscription.plan as PlanType;
        if (
          (currentPlan === 'enterprise') ||
          (currentPlan === 'pro' && input.plan === 'pro')
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You already have this plan or a higher tier',
          });
        }
      }

      const session = await createCheckoutSession(
        ctx.userId,
        input.plan,
        user.email
      );

      return { checkoutUrl: session.url };
    }),

  // Create customer portal session
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await ctx.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, ctx.userId),
    });

    if (!subscription?.stripeCustomerId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No active subscription found',
      });
    }

    const session = await createCustomerPortalSession(
      subscription.stripeCustomerId
    );

    return { portalUrl: session.url };
  }),

  // Cancel subscription
  cancel: protectedProcedure
    .input(
      z.object({
        immediately: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const subscription = await ctx.db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, ctx.userId),
      });

      if (!subscription?.stripeSubscriptionId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No active subscription found',
        });
      }

      await cancelSubscription(
        subscription.stripeSubscriptionId,
        !input.immediately
      );

      return { success: true };
    }),

  // Reactivate canceled subscription
  reactivate: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await ctx.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, ctx.userId),
    });

    if (!subscription?.stripeSubscriptionId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No subscription found',
      });
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Subscription is not scheduled for cancellation',
      });
    }

    await reactivateSubscription(subscription.stripeSubscriptionId);

    return { success: true };
  }),

  // Get usage statistics
  getUsage: protectedProcedure.query(async ({ ctx }) => {
    // Get subscription to determine limits
    const subscription = await ctx.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, ctx.userId),
    });

    const plan = (subscription?.plan || 'free') as PlanType;
    const limits = PLANS[plan].limits;

    // Get current month's start date
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get usage for current month
    const usage = await ctx.db
      .select({
        resourceType: usageTracking.resourceType,
        total: sql<number>`sum(${usageTracking.amount})`,
      })
      .from(usageTracking)
      .where(
        and(
          eq(usageTracking.userId, ctx.userId),
          gte(usageTracking.createdAt, monthStart)
        )
      )
      .groupBy(usageTracking.resourceType);

    const usageMap = usage.reduce(
      (acc, u) => {
        acc[u.resourceType] = Number(u.total);
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      plan,
      limits,
      usage: {
        aiTokens: usageMap['ai_tokens'] || 0,
        storage: usageMap['storage'] || 0,
        exports: usageMap['exports'] || 0,
      },
      percentages: {
        aiTokens:
          limits.aiTokens === -1
            ? 0
            : ((usageMap['ai_tokens'] || 0) / limits.aiTokens) * 100,
        storage:
          limits.storage === -1
            ? 0
            : ((usageMap['storage'] || 0) / limits.storage) * 100,
        exports:
          limits.exports === -1
            ? 0
            : ((usageMap['exports'] || 0) / limits.exports) * 100,
      },
    };
  }),

  // Track usage
  trackUsage: protectedProcedure
    .input(
      z.object({
        resourceType: z.enum(['ai_tokens', 'storage', 'exports']),
        amount: z.number(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.db.insert(usageTracking).values({
        userId: ctx.userId,
        resourceType: input.resourceType,
        amount: input.amount,
        metadata: input.metadata,
      });

      return { success: true };
    }),

  // Check if user can perform action (within limits)
  checkLimit: protectedProcedure
    .input(
      z.object({
        resourceType: z.enum(['ai_tokens', 'storage', 'exports', 'books']),
        amount: z.number().default(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const subscription = await ctx.db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, ctx.userId),
      });

      const plan = (subscription?.plan || 'free') as PlanType;
      const limits = PLANS[plan].limits;

      const limit = limits[input.resourceType as keyof typeof limits];

      // -1 means unlimited
      if (limit === -1) {
        return { allowed: true, remaining: -1 };
      }

      // Get current month's usage
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [usage] = await ctx.db
        .select({
          total: sql<number>`coalesce(sum(${usageTracking.amount}), 0)`,
        })
        .from(usageTracking)
        .where(
          and(
            eq(usageTracking.userId, ctx.userId),
            eq(usageTracking.resourceType, input.resourceType),
            gte(usageTracking.createdAt, monthStart)
          )
        );

      const used = Number(usage?.total || 0);
      const remaining = limit - used;
      const allowed = remaining >= input.amount;

      return { allowed, remaining, used, limit };
    }),
});
