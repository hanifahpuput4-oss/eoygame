import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient, type Client } from '@libsql/client';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  __llysDbClient?: Client;
  __llysDb?: LibSQLDatabase<typeof schema>;
  __llysPragmaInit?: boolean;
};

const client =
  globalForDb.__llysDbClient ??
  createClient({
    url: process.env.DATABASE_URL ?? 'file:local.db',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__llysDbClient = client;
}

if (!globalForDb.__llysPragmaInit) {
  globalForDb.__llysPragmaInit = true;
  const dbUrl = process.env.DATABASE_URL ?? 'file:local.db';
  if (dbUrl.startsWith('file:')) {
    void client
      .batch([
        'PRAGMA journal_mode = WAL;',
        'PRAGMA synchronous = NORMAL;',
        'PRAGMA busy_timeout = 5000;',
        'PRAGMA temp_store = MEMORY;',
        'PRAGMA cache_size = -20000;',
        'PRAGMA foreign_keys = ON;',
      ])
      .catch(() => {});
  }
}

export const db = globalForDb.__llysDb ?? drizzle(client, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__llysDb = db;
}
