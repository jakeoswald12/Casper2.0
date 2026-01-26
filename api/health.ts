import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSqlClient } from './_db';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const checks: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: {
      DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'missing',
      JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'missing',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'set' : 'missing',
    },
  };

  // Test database connection
  try {
    const sql = getSqlClient();
    const result = await sql`SELECT 1 as test`;
    checks.database = { status: 'connected', result: result[0]?.test };
  } catch (error: any) {
    checks.database = {
      status: 'error',
      message: error.message,
      code: error.code,
    };
    checks.status = 'degraded';
  }

  // Check if tables exist
  if (checks.database?.status === 'connected') {
    try {
      const sql = getSqlClient();
      const tables = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        LIMIT 10
      `;
      checks.tables = tables.map((t: any) => t.table_name);
    } catch (error: any) {
      checks.tables = { error: error.message };
    }
  }

  res.status(checks.status === 'ok' ? 200 : 503).json(checks);
}
