import { createApp } from '../../src/server';
import { openDb, initDb, resetDb } from '../../src/db';
import path from 'node:path';

export { resetDb };

export function makeTestApp() {
  const db = openDb();
  initDb(db);
  const app = createApp({ db });
  return { app, db };
}

export function fixturePath(rel: string) {
  return path.join(__dirname, '..', 'fixtures', rel);
}


