import createApp from '../../src/server';
import { db } from '../../src/db';

export function resetDb() {
  db.exec(`DELETE FROM transactions`);
}

export function makeTestApp() {
  resetDb();
  const app = createApp();
  return { app };
}


