import { Router } from 'express';
import { db } from '../db';

const devResetRouter = Router();

devResetRouter.post('/dev/reset', (_req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ ok: false, error: 'Reset not available in production.' });
  }

  try {
    db.prepare('DELETE FROM transactions').run();
    db.prepare('DELETE FROM imports').run();
    try {
      db.prepare('DELETE FROM sqlite_sequence WHERE name IN (?, ?)').run('transactions', 'imports');
    } catch (err) {
      console.warn('[dev/reset] sequence reset failed', err);
    }

    return res.json({ ok: true, message: 'Demo-Daten zurückgesetzt.' });
  } catch (error) {
    console.error('[dev/reset] failed', error);
    return res.status(500).json({ ok: false, error: 'Reset failed' });
  }
});

export default devResetRouter;


