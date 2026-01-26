import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../server/routers';
import { db } from '../server/db';
import { verifyToken, type JWTPayload } from '../server/lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Convert Vercel request to Fetch API Request
  const url = new URL(req.url || '', `https://${req.headers.host}`);

  // Get auth token from header or cookie
  let user: JWTPayload | null = null;
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.cookies?.token;

  if (token) {
    user = await verifyToken(token);
  }

  // Handle the tRPC request
  const response = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req: new Request(url, {
      method: req.method,
      headers: new Headers(req.headers as Record<string, string>),
      body: req.method !== 'GET' && req.method !== 'HEAD'
        ? JSON.stringify(req.body)
        : undefined,
    }),
    router: appRouter,
    createContext: () => ({
      req: req as any,
      res: res as any,
      db,
      user,
    }),
    onError: ({ path, error }) => {
      console.error(`tRPC error on ${path}:`, error.message);
    },
  });

  // Copy response headers
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  // Send response
  res.status(response.status);
  const body = await response.text();
  res.send(body);
}
