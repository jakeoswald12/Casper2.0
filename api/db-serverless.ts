// Self-contained database module for Vercel serverless functions
// This module must not import from ../server/ as Vercel bundles each function separately

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../drizzle/schema';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;

function parseConnectionString(connectionString: string) {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    database: url.pathname.slice(1),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

export function getDb() {
  if (db) return db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const params = parseConnectionString(connectionString);

  sqlClient = postgres({
    ...params,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: 'require',
  });

  db = drizzle(sqlClient, { schema });
  return db;
}

export function getSqlClient() {
  if (sqlClient) return sqlClient;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const params = parseConnectionString(connectionString);

  sqlClient = postgres({
    ...params,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: 'require',
  });

  return sqlClient;
}

export { schema };
