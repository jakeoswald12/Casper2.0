import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

// Subscription plans configuration
export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    stripePriceId: null,
    limits: {
      aiTokens: 100_000, // per month
      storage: 100 * 1024 * 1024, // 100MB
      exports: 5, // per month
      books: 3,
    },
    features: [
      '100K AI tokens/month',
      '100MB storage',
      '5 exports/month',
      'Up to 3 books',
      'Basic support',
    ],
  },
  pro: {
    name: 'Pro',
    price: 2900, // $29/month in cents
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || '',
    limits: {
      aiTokens: 5_000_000,
      storage: 5 * 1024 * 1024 * 1024, // 5GB
      exports: -1, // unlimited
      books: -1, // unlimited
    },
    features: [
      '5M AI tokens/month',
      '5GB storage',
      'Unlimited exports',
      'Unlimited books',
      'Priority support',
      'Extended thinking mode',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: 9900, // $99/month in cents
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
    limits: {
      aiTokens: -1, // unlimited
      storage: -1, // unlimited
      exports: -1, // unlimited
      books: -1, // unlimited
    },
    features: [
      'Unlimited AI tokens',
      'Unlimited storage',
      'Unlimited exports',
      'Unlimited books',
      'Dedicated support',
      'Extended thinking mode',
      'Custom AI model selection',
      'Team collaboration (coming soon)',
    ],
  },
} as const;

export type PlanType = keyof typeof PLANS;

export function getPlanLimits(plan: PlanType) {
  return PLANS[plan].limits;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function createCheckoutSession(
  userId: number,
  plan: 'pro' | 'enterprise',
  email: string,
  successUrl?: string,
  cancelUrl?: string
): Promise<Stripe.Checkout.Session> {
  const priceId = PLANS[plan].stripePriceId;

  if (!priceId) {
    throw new Error(`No price ID configured for plan: ${plan}`);
  }

  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl || `${process.env.APP_URL}/dashboard?checkout=success`,
    cancel_url: cancelUrl || `${process.env.APP_URL}/pricing?checkout=canceled`,
    metadata: {
      userId: userId.toString(),
      plan,
    },
    subscription_data: {
      metadata: {
        userId: userId.toString(),
        plan,
      },
    },
    allow_promotion_codes: true,
  });

  return session;
}

export async function createCustomerPortalSession(
  stripeCustomerId: string,
  returnUrl?: string
): Promise<Stripe.BillingPortal.Session> {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl || `${process.env.APP_URL}/settings`,
  });

  return session;
}

export async function cancelSubscription(
  stripeSubscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  if (cancelAtPeriodEnd) {
    return stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return stripe.subscriptions.cancel(stripeSubscriptionId);
  }
}

export async function reactivateSubscription(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
}

export function constructWebhookEvent(
  payload: Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
