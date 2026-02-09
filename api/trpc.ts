import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { getDb } from './db-serverless';
import { appRouter } from '../server/routers';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: number;
  openId: string;
}

async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const decoded = jwt.verify(token, secret) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = getDb();

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
  } catch (error: any) {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      details: error.stack?.split('\n').slice(0, 5)
    });
  }
}
