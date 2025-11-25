/**
 * SQLiteDatabase - SQLite implementation of IDatabase
 * 
 * Wraps better-sqlite3 to provide a pluggable database abstraction.
 * This prepares Nimbus for future database backends (e.g., PostgreSQL via Prisma).
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { IDatabase } from './IDatabase';

export class SQLiteDatabase implements IDatabase {
  constructor(private db: BetterSqliteDatabase) {}

  query<T = any>(sql: string, params?: any[]): T[] {
    const stmt = this.db.prepare(sql);
    return (params ? stmt.all(...params) : stmt.all()) as T[];
  }

  queryOne<T = any>(sql: string, params?: any[]): T | undefined {
    const stmt = this.db.prepare(sql);
    return (params ? stmt.get(...params) : stmt.get()) as T | undefined;
  }

  execute(sql: string, params?: any[]): void {
    const stmt = this.db.prepare(sql);
    if (params) {
      stmt.run(...params);
    } else {
      stmt.run();
    }
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}

/**
 * Singleton SQLite database instance using the abstraction.
 * Import this instead of the raw db instance for new code.
 */
let sqliteDatabaseInstance: SQLiteDatabase | null = null;

export function createSQLiteDatabase(db: BetterSqliteDatabase): SQLiteDatabase {
  if (!sqliteDatabaseInstance) {
    sqliteDatabaseInstance = new SQLiteDatabase(db);
  }
  return sqliteDatabaseInstance;
}

export function getSQLiteDatabase(): SQLiteDatabase | null {
  return sqliteDatabaseInstance;
}

