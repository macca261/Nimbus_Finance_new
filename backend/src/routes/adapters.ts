import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

router.post('/adapters/user', (req, res) => {
  try {
    const adapter = req.body;
    if (!adapter || typeof adapter !== 'object' || !adapter.id) {
      return res.status(400).json({ error: 'Invalid adapter payload' });
    }
    const dir = path.resolve(process.cwd(), './data/user-adapters');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${adapter.id}.json`);
    fs.writeFileSync(file, JSON.stringify(adapter, null, 2), 'utf8');
    return res.json({ ok: true, id: adapter.id });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to save adapter', details: e?.message || 'unknown' });
  }
});

export default router;


