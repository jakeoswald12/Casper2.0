import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../drizzle/schema';
import { appRouter } from '../server/routers';
import { jwtVerify } from 'jose';

export const config = { maxDuration: 60 };

// --- Inline DB connection (avoids ESM import issues between api/ files) ---

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb() {
  if (db) return db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Parse URL explicitly because postgres.js truncates usernames
  // containing dots (e.g. Supabase "postgres.projectref")
  const parsed = new URL(connectionString);
  const sqlClient = postgres({
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432'),
    database: parsed.pathname.slice(1),
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: 'require',
  });

  db = drizzle(sqlClient, { schema });
  return db;
}

// --- JWT verification using jose (same lib as server/lib/auth.ts) ---

interface JWTPayload {
  userId: number;
  openId: string;
  email?: string;
  role: string;
}

async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// --- Handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const database = getDb();

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
        db: database,
        user,
      }),
      onError: ({ path, error }) => {
        console.error(`tRPC error on ${path}:`, error.message);
      },
    });

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.status(response.status);
    const body = await response.text();
    res.send(body);
  } catch (error: any) {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      details: error.stack?.split('\n').slice(0, 5),
    });
  }
}
