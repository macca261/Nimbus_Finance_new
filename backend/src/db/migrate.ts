import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_DB_DIR = path.resolve(__dirname, '..', 'data');
const DEFAULT_DB_FILE = 'nimbus.sqlite';
const envPath = (process.env.NIMBUS_DB_PATH || process.env.DB_FILE || '').trim();
const dbPath = envPath ? path.resolve(envPath) : path.resolve(DEFAULT_DB_DIR, DEFAULT_DB_FILE);

if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);
const migrationsDir = path.join(__dirname, 'migrations');

db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id TEXT PRIMARY KEY,
    appliedAt TEXT NOT NULL
  );
`);

if (!fs.existsSync(migrationsDir)) {
  console.warn('[migrate] no migrations directory found at', migrationsDir);
  process.exit(0);
}

const files = fs
  .readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .sort();

for (const file of files) {
  const applied = db.prepare('SELECT 1 FROM _migrations WHERE id = ?').get(file);
  if (applied) {
    continue;
  }

  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  const exec = db.transaction((script: string) => {
    db.exec(script);
    db.prepare('INSERT INTO _migrations (id, appliedAt) VALUES (?, datetime("now"))').run(file);
  });

  exec(sql);
  console.log('[migrate] Applied migration', file);
}

console.log('[migrate] Migrations complete.');


