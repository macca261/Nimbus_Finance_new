import type { Database } from '../db';
import { db } from '../db';

export async function getDb(): Promise<Database> {
  return db;
}


