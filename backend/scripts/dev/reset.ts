import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(__dirname, '..', '..', 'data');
const dbPath = path.join(dataDir, 'dev.db');

try { if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); } catch {}
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Import db to re-create schema
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('../../src/db');
console.log('DB reset at', dbPath);


