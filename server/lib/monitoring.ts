/**
 * Monitoring and error tracking utilities
 *
 * In production, integrate with Sentry or similar service.
 * This module provides a consistent API for error tracking.
 */

interface ErrorContext {
  userId?: number;
  bookId?: number;
  sessionId?: number;
  action?: string;
  metadata?: Record<string, any>;
}

/**
 * Initialize monitoring services
 */
export function initMonitoring() {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    // In production with Sentry DSN configured:
    // import * as Sentry from '@sentry/node';
    // Sentry.init({
    //   dsn: process.env.SENTRY_DSN,
    //   environment: process.env.NODE_ENV,
    //   tracesSampleRate: 0.1,
    // });
    console.log('Monitoring initialized (Sentry DSN configured)');
  } else {
    console.log('Monitoring running in development mode (console only)');
  }
}

/**
 * Capture and report an error
 */
export function captureError(error: Error, context?: ErrorContext) {
  const timestamp = new Date().toISOString();

  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    // Sentry.captureException(error, { extra: context });
    console.error(`[${timestamp}] Error captured:`, error.message);
  } else {
    console.error(`[${timestamp}] Error:`, {
      message: error.message,
      stack: error.stack,
      ...context,
    });
  }
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

  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    // Sentry.captureMessage(message, { level, extra: context });
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  } else {
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, context);
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: number, email?: string) {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    // Sentry.setUser({ id: userId.toString(), email });
  }
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext() {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    // Sentry.setUser(null);
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
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    // Sentry.addBreadcrumb({ category, message, data });
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
