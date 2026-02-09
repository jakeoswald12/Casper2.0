import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './routers';
import { db } from './db';
import { authMiddleware } from './lib/auth';
import { handleStripeWebhook } from './webhooks/stripe';
import { streamChat } from './lib/agentLoop';
import { apiLimiter, chatLimiter } from './lib/rateLimiter';
import { initMonitoring } from './lib/monitoring';
import type { Context } from './trpc';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize monitoring
initMonitoring();

// Stripe webhook endpoint (needs raw body, must be before JSON middleware)
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    const result = await handleStripeWebhook(req.body, signature);

    if (result.received) {
      res.json({ received: true, type: result.type });
    } else {
      res.status(400).json({ error: result.error });
    }
  }
);

// Middleware
app.use(
  cors({
    origin: process.env.APP_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(authMiddleware);

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI Chat streaming endpoint (SSE)
app.post('/api/chat', chatLimiter, async (req, res) => {
  // Authenticate
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { message, bookId, sessionId } = req.body;

  if (!message || !bookId || !sessionId) {
    return res.status(400).json({ error: 'Missing required fields: message, bookId, sessionId' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const stream = streamChat({
      message,
      bookId: Number(bookId),
      sessionId: Number(sessionId),
      userId: req.user.userId,
    });

    for await (const event of stream) {
      if (res.destroyed) break;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.write(`data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`);
  } finally {
    res.end();
  }
});

// tRPC handler
app.use(
  '/api/trpc',
  apiLimiter,
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: ({ req, res }): Context => ({
      req,
      res,
      db,
      user: req.user,
    }),
    onError: ({ path, error }) => {
      console.error(`tRPC error on ${path}:`, error.message);
    },
  })
);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist/client'));
  app.get('*', (_, res) => {
    res.sendFile('index.html', { root: 'dist/client' });
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════════════════════╗
  ║                                                            ║
  ║   🚀 Casper 2.0 Server Running                            ║
  ║                                                            ║
  ║   Local:    http://localhost:${PORT}                        ║
  ║   API:      http://localhost:${PORT}/api/trpc               ║
  ║                                                            ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}                           ║
  ║                                                            ║
  ╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export { appRouter };
export type { AppRouter } from './routers';
