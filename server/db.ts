import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { dbLogger as logger } from "./logger";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// ─── Connection Pool with proper limits (Upgrade #6) ───
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                      // limit pool size (NeonDB free tier safe)
  idleTimeoutMillis: 30000,     // free idle connections after 30s
  connectionTimeoutMillis: 5000, // fail fast if can't connect in 5s
});

// Handle pool errors gracefully
pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

export const db = drizzle({ client: pool, schema });

logger.info('Database pool initialized (max: 10, idle: 30s, timeout: 5s)');