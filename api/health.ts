import type { VercelRequest, VercelResponse } from '@vercel/node';
import postgres from 'postgres';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const checks: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.4',
    build: 'ssl-fix',
    environment: {
      DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'missing',
      JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'missing',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'set' : 'missing',
    },
  };

  if (process.env.DATABASE_URL) {
    try {
      // Parse the URL to extract components
      const url = new URL(process.env.DATABASE_URL);
      const username = decodeURIComponent(url.username);
      const password = decodeURIComponent(url.password);
      const host = url.hostname;
      const port = url.port || '5432';
      const database = url.pathname.slice(1);

      checks.debug = {
        username: username,
        host: host,
        port: port,
        database: database,
      };

      // Try with SSL required (Supabase needs this)
      const sql = postgres({
        host: host,
        port: parseInt(port),
        database: database,
        username: username,
        password: password,
        max: 1,
        idle_timeout: 20,
        connect_timeout: 10,
        prepare: false,
        ssl: 'require',
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
