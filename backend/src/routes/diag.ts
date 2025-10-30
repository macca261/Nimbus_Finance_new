import { Router } from 'express';

const router = Router();
let lastImport: any = null;
export function setLastImport(diag: any) { lastImport = diag; }

router.get('/__health', (_req, res) => {
  res.json({ ok: true, version: process.env.npm_package_version || 'dev', time: new Date().toISOString() });
});

router.get('/__diag', (_req, res) => {
  let hasParser = false;
  try { require.resolve('@nimbus/parser-de'); hasParser = true; } catch {}
  let adapters = 0;
  try {
    // If adapter JSONs exist under shared/adapters
    const fs = require('fs');
    const path = require('path');
    const dir = path.resolve(process.cwd(), '../shared/adapters');
    adapters = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f: string) => f.endsWith('.json')).length : 0;
  } catch {}
  res.json({ hasParser, adapters });
});

router.get('/last-import', (_req, res) => {
  res.json(lastImport || { note: 'no import yet' });
});

router.get('/ping', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

export default router;


