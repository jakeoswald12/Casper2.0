// Self-contained database module for Vercel serverless functions
// This module must not import from ../server/ as Vercel bundles each function separately

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../drizzle/schema';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;

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

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  return postgres({
    ...parseDbUrl(connectionString),
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: 'require',
  });
}

export function getDb() {
  if (db) return db;

  sqlClient = createClient();
  db = drizzle(sqlClient, { schema });
  return db;
}

export function getSqlClient() {
  if (sqlClient) return sqlClient;

  sqlClient = createClient();
  return sqlClient;
}

export { schema };
