/**
 * IDatabase - Minimal database abstraction layer
 * 
 * This interface provides a thin abstraction over better-sqlite3 to prepare
 * Nimbus for future database backends (e.g., PostgreSQL via Prisma).
 * 
 * Keep this minimal; we are not building a full ORM, just a pluggable DAL.
 */

export interface IDatabase {
  /**
   * Execute a SELECT query and return all rows.
   * @param sql - SQL query with ? placeholders
   * @param params - Array of parameters for the query
   * @returns Array of result rows
   */
  query<T = any>(sql: string, params?: any[]): T[];

  /**
   * Execute a SELECT query and return the first row, or undefined if none.
   * @param sql - SQL query with ? placeholders
   * @param params - Array of parameters for the query
   * @returns First row or undefined
   */
  queryOne<T = any>(sql: string, params?: any[]): T | undefined;

  /**
   * Execute an INSERT, UPDATE, or DELETE statement.
   * @param sql - SQL statement with ? placeholders
   * @param params - Array of parameters for the statement
   */
  execute(sql: string, params?: any[]): void;

  /**
   * Execute a function within a database transaction.
   * If the function throws, the transaction is rolled back.
   * @param fn - Function to execute within the transaction
   * @returns Return value of the function
   */
  transaction<T>(fn: () => T): T;
}

