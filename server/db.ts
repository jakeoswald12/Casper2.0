import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../drizzle/schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create postgres client (serverless-friendly settings)
const client = postgres(connectionString, {
  max: 1, // Serverless: use minimal connections
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false, // Required for some connection poolers like Supabase
});

// Create drizzle instance with schema
export const db = drizzle(client, { schema });

export type Database = typeof db;
