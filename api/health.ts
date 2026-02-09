import type { VercelRequest, VercelResponse } from '@vercel/node';
import postgres from 'postgres';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const checks: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.5',
    build: 'url-direct',
    environment: {
      DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'missing',
      JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'missing',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'set' : 'missing',
    },
  };

  if (process.env.DATABASE_URL) {
    try {
      // Add sslmode to URL if not present
      let dbUrl = process.env.DATABASE_URL;
      if (!dbUrl.includes('sslmode=')) {
        dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'sslmode=require';
      }

      checks.debug = {
        urlWithSsl: dbUrl.replace(/:[^:@]+@/, ':***@'), // hide password
      };

      // Pass URL directly to postgres
      const sql = postgres(dbUrl, {
        max: 1,
        idle_timeout: 20,
        connect_timeout: 10,
        prepare: false,
      });

      const result = await sql`SELECT 1 as test`;
      checks.database = { status: 'connected', result: result[0]?.test };

      const tables = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        LIMIT 10
      `;
      checks.tables = tables.map((t: any) => t.table_name);

      await sql.end();
    } catch (error: any) {
      checks.database = {
        status: 'error',
        message: error.message,
        code: error.code,
      };
      checks.status = 'degraded';
    }
  } else {
    checks.database = { status: 'error', message: 'DATABASE_URL not set' };
    checks.status = 'degraded';
  }

  res.status(checks.status === 'ok' ? 200 : 503).json(checks);
}
