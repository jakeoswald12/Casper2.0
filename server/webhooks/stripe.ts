import Stripe from 'stripe';
import { db } from '../db';
import { subscriptions, usageTracking } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { constructWebhookEvent } from '../lib/stripe';

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string
): Promise<{ received: boolean; type?: string; error?: string }> {
  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return { received: false, error: 'Invalid signature' };
  }

  console.log(`Received Stripe webhook: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true, type: event.type };
  } catch (error: any) {
    console.error(`Error handling webhook ${event.type}:`, error);
    return { received: false, error: error.message };
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = parseInt(session.metadata?.userId || '0');
  const plan = session.metadata?.plan as 'pro' | 'enterprise';

  if (!userId || !plan) {
    console.error('Missing userId or plan in checkout session metadata');
    return;
  }

  // Check if subscription already exists
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (existing) {
    // Update existing subscription
    await db
      .update(subscriptions)
      .set({
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        plan,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId));
  } else {
    // Create new subscription
    await db.insert(subscriptions).values({
      userId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      plan,
      status: 'active',
    });
  }

  console.log(`Checkout completed for user ${userId}, plan: ${plan}`);
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = parseInt(subscription.metadata?.userId || '0');
  const plan = subscription.metadata?.plan as 'pro' | 'enterprise';

  if (!userId) {
    console.log('Subscription created without userId metadata, skipping');
    return;
  }

  // Check if already handled by checkout.session.completed
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeSubscriptionId, subscription.id),
  });

  if (!existing) {
    await db.insert(subscriptions).values({
      userId,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price.id,
      plan: plan || 'pro',
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  await db
    .update(subscriptions)
    .set({
      status: subscription.status,
      stripePriceId: subscription.items.data[0]?.price.id,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  console.log(`Subscription ${subscription.id} updated to status: ${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  console.log(`Subscription ${subscription.id} deleted/canceled`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Reset usage counters on successful payment (new billing period)
  const subscriptionId = invoice.subscription as string;

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeSubscriptionId, subscriptionId),
  });

  if (sub) {
    // Track the payment
    await db.insert(usageTracking).values({
      userId: sub.userId,
      resourceType: 'payment',
      amount: invoice.amount_paid,
      metadata: {
        invoiceId: invoice.id,
        periodStart: invoice.period_start,
        periodEnd: invoice.period_end,
      },
    });

    console.log(`Payment succeeded for subscription ${subscriptionId}`);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  await db
    .update(subscriptions)
    .set({
      status: 'past_due',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

  console.log(`Payment failed for subscription ${subscriptionId}`);
}
