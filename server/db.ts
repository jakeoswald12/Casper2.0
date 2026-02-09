import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../drizzle/schema';

// Lazy initialization to avoid top-level execution crashes in serverless environments.
// When imported via the router chain in Vercel, this module is evaluated but the db
// connection should only be created when actually used (standalone workers, not tRPC
// procedures which receive db via context).
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlClient: ReturnType<typeof postgres> | null = null;

// Parse URL and pass explicit credentials to postgres() because
// postgres.js truncates usernames containing dots (e.g. Supabase pooler
// usernames like "postgres.projectref" become just "postgres").
function parseDbUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432'),
    database: parsed.pathname.slice(1),
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

function ensureInitialized() {
  if (_db) return;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  _sqlClient = postgres({
    ...parseDbUrl(connectionString),
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: 'require',
  });

  _db = drizzle(_sqlClient, { schema });
}

// Lazy proxy: initializes on first property access, not at import time
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    ensureInitialized();
    return (_db as any)[prop];
  },
});

export const sqlClient = new Proxy({} as ReturnType<typeof postgres>, {
  get(_, prop) {
    ensureInitialized();
    return (_sqlClient as any)[prop];
  },
});

export type Database = ReturnType<typeof drizzle<typeof schema>>;
