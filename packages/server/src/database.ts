import { Pool, PoolClient } from 'pg';
import { MedplumDatabaseConfig, MedplumServerConfig } from './config';
import { globalLogger } from './logger';
import * as migrations from './migrations/schema';
import { sleep } from '@medplum/core';

export enum DatabaseMode {
  READER = 'reader',
  WRITER = 'writer',
}

let pool: Pool | undefined;
let readonlyPool: Pool | undefined;

export function getDatabasePool(mode: DatabaseMode): Pool {
  if (!pool) {
    throw new Error('Database not setup');
  }

  if (mode === DatabaseMode.READER && readonlyPool) {
    return readonlyPool;
  }

  return pool;
}

export const locks = {
  migration: 1,
};

export async function initDatabase(serverConfig: MedplumServerConfig): Promise<void> {
  pool = await initPool(serverConfig.database, serverConfig.databaseProxyEndpoint);

  if (serverConfig.database.runMigrations !== false) {
    await runMigrations(pool);
  }

  if (serverConfig.readonlyDatabase) {
    readonlyPool = await initPool(serverConfig.readonlyDatabase, serverConfig.readonlyDatabaseProxyEndpoint);
  }
}

async function initPool(config: MedplumDatabaseConfig, proxyEndpoint: string | undefined): Promise<Pool> {
  const poolConfig = {
    host: config.host,
    port: config.port,
    database: config.dbname,
    user: config.username,
    password: config.password,
    application_name: 'medplum-server',
    ssl: config.ssl,
    max: config.maxConnections ?? 100,
  };

  if (proxyEndpoint) {
    poolConfig.host = proxyEndpoint;
    poolConfig.ssl = poolConfig.ssl ?? {};
    poolConfig.ssl.require = true;
  }

  const pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    globalLogger.error('Database connection error', err);
  });

  if (!config.disableConnectionConfiguration) {
    pool.on('connect', (client) => {
      client.query(`SET statement_timeout TO ${config.queryTimeout ?? 60000}`).catch((err) => {
        globalLogger.warn('Failed to set query timeout', err);
      });
      client.query(`SET default_transaction_isolation TO 'REPEATABLE READ'`).catch((err) => {
        globalLogger.warn('Failed to set default transaction isolation', err);
      });
    });
  }

  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }

  if (readonlyPool) {
    await readonlyPool.end();
    readonlyPool = undefined;
  }
}

async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  let hasLock = false;
  try {
    hasLock = await acquireAdvisoryLock(client, locks.migration);
    if (!hasLock) {
      throw new Error('Failed to acquire migration lock');
    }
    await client.query(`SET statement_timeout TO 0`); // Disable timeout for migrations AFTER getting lock
    await migrate(client);
  } catch (err: any) {
    globalLogger.error('Database schema migration error', err);
    throw err;
  } finally {
    if (hasLock) {
      await releaseAdvisoryLock(client, locks.migration);
    }
    client.release(true); // Ensure migration connection is torn down and not re-used
  }
}

type AcquireAdvisoryLockOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
};

export async function acquireAdvisoryLock(
  client: PoolClient,
  lockId: number,
  options?: AcquireAdvisoryLockOptions
): Promise<boolean> {
  const retryDelayMs = options?.retryDelayMs ?? 2000;
  const maxAttempts = options?.maxAttempts ?? 30;
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    const result = await client.query<{ pg_try_advisory_lock: boolean }>('SELECT pg_try_advisory_lock($1)', [lockId]);
    if (result.rows[0].pg_try_advisory_lock) {
      return true;
    }
    if (attempts < maxAttempts) {
      await sleep(retryDelayMs);
    }
  }

  return false;
}

export async function releaseAdvisoryLock(client: PoolClient, lockId: number): Promise<void> {
  await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
}

async function migrate(client: PoolClient): Promise<void> {
  await client.query(`CREATE TABLE IF NOT EXISTS "DatabaseMigration" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "dataVersion" INTEGER NOT NULL
  )`);

  const result = await client.query('SELECT "version" FROM "DatabaseMigration"');
  const version = result.rows[0]?.version ?? -1;

  if (version < 0) {
    await client.query('INSERT INTO "DatabaseMigration" ("id", "version", "dataVersion") VALUES (1, 0, 0)');
  }

  const migrationKeys = Object.keys(migrations);
  for (let i = version + 1; i <= migrationKeys.length; i++) {
    const migration = (migrations as Record<string, migrations.Migration>)['v' + i];
    if (migration) {
      const start = Date.now();
      await migration.run(client);
      globalLogger.info('Database schema migration', { version: `v${i}`, duration: `${Date.now() - start} ms` });
      await client.query('UPDATE "DatabaseMigration" SET "version"=$1', [i]);
    }
  }
}
