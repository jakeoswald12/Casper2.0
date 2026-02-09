import { defineConfig } from 'drizzle-kit';

// Parse URL explicitly because postgres.js (used by drizzle-kit) truncates
// usernames containing dots (e.g. Supabase "postgres.projectref").
const dbUrl = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL)
  : null;

export default defineConfig({
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: dbUrl
    ? {
        host: dbUrl.hostname,
        port: parseInt(dbUrl.port || '5432'),
        database: dbUrl.pathname.slice(1),
        user: decodeURIComponent(dbUrl.username),
        password: decodeURIComponent(dbUrl.password),
        ssl: 'require',
      }
    : { url: '' },
});
