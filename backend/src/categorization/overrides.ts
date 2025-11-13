import { db } from '../db';
import { getDb } from '../storage/db';

export type CategoryOverride = {
  id: string;
  category: string;
  source: 'user';
  updatedAt: string;
};

let tableEnsured = false;

async function ensureOverridesTableAsync(): Promise<void> {
  if (tableEnsured) return;
  const conn = await getDb();
  conn.exec(`
    CREATE TABLE IF NOT EXISTS user_overrides (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'user',
      updatedAt TEXT NOT NULL
    );
  `);
  tableEnsured = true;
}

function ensureOverridesTableSync(): void {
  if (tableEnsured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_overrides (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'user',
      updatedAt TEXT NOT NULL
    );
  `);
  tableEnsured = true;
}

export async function ensureOverridesTable(): Promise<void> {
  await ensureOverridesTableAsync();
}

export async function setOverride(id: string, category: string): Promise<void> {
  if (!id) return;
  await ensureOverridesTableAsync();
  const conn = await getDb();
  const now = new Date().toISOString();
  conn
    .prepare(
      `INSERT INTO user_overrides (id, category, source, updatedAt)
       VALUES (?, ?, 'user', ?)
       ON CONFLICT(id)
       DO UPDATE SET category = excluded.category, updatedAt = excluded.updatedAt`,
    )
    .run(id, category, now);
}

export async function clearOverride(id: string): Promise<void> {
  if (!id) return;
  await ensureOverridesTableAsync();
  const conn = await getDb();
  conn.prepare(`DELETE FROM user_overrides WHERE id = ?`).run(id);
}

export async function getOverride(id: string): Promise<CategoryOverride | null> {
  if (!id) return null;
  await ensureOverridesTableAsync();
  const conn = await getDb();
  const row = conn.prepare(`SELECT * FROM user_overrides WHERE id = ?`).get(id) as CategoryOverride | undefined;
  return row ?? null;
}

export function getOverrideSync(id: string): CategoryOverride | null {
  if (!id) return null;
  ensureOverridesTableSync();
  const row = db.prepare(`SELECT * FROM user_overrides WHERE id = ?`).get(id) as CategoryOverride | undefined;
  return row ?? null;
}


