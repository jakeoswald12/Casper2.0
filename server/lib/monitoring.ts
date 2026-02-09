/**
 * Monitoring and error tracking utilities using Sentry.
 *
 * Set SENTRY_DSN in .env to enable Sentry in production.
 * When not configured, errors are logged to console.
 */
import * as Sentry from '@sentry/node';

interface ErrorContext {
  userId?: number;
  bookId?: number;
  sessionId?: number;
  action?: string;
  metadata?: Record<string, any>;
}

let sentryEnabled = false;

/**
 * Initialize monitoring services
 */
export function initMonitoring() {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
    sentryEnabled = true;
    console.log('Monitoring initialized (Sentry enabled)');
  } else {
    console.log('Monitoring running in development mode (console only)');
  }
}

/**
 * Capture and report an error
 */
export function captureError(error: Error, context?: ErrorContext) {
  const timestamp = new Date().toISOString();

  if (sentryEnabled) {
    Sentry.captureException(error, { extra: context as Record<string, unknown> });
  }

  console.error(`[${timestamp}] Error:`, {
    message: error.message,
    stack: error.stack,
    ...context,
  });
}

/**
 * Capture a custom message/event
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
) {
  const timestamp = new Date().toISOString();

  if (sentryEnabled) {
    Sentry.captureMessage(message, { level, extra: context });
  }

  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, context || '');
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: number, email?: string) {
  if (sentryEnabled) {
    Sentry.setUser({ id: userId.toString(), email });
  }
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext() {
  if (sentryEnabled) {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, any>
) {
  if (sentryEnabled) {
    Sentry.addBreadcrumb({ category, message, data });
  }
}

/**
 * Performance monitoring - start a transaction
 */
export function startTransaction(name: string, op: string) {
  const startTime = Date.now();

  return {
    finish: () => {
      const duration = Date.now() - startTime;
      if (process.env.NODE_ENV === 'development' || duration > 1000) {
        console.log(`[PERF] ${name} (${op}): ${duration}ms`);
      }
    },
  };
}

/**
 * Simple request logging middleware
 */
export function requestLogger(
  req: any,
  res: any,
  next: () => void
) {
  const startTime = Date.now();
  const path = req.path || req.url;
  const method = req.method;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode;

    // Only log slow requests or errors in development
    if (
      process.env.NODE_ENV === 'development' ||
      duration > 1000 ||
      status >= 400
    ) {
      console.log(
        `[${new Date().toISOString()}] ${method} ${path} - ${status} (${duration}ms)`
      );
    }
  });

  next();
}
