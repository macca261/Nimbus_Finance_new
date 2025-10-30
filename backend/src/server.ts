import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRouter from './routes/auth';
import csvRouter from './routes/csv';
import providersRouter from './routes/providers';
import adaptersRouter from './routes/adapters';
import importsRouter from './routes/imports';
import transactionsRouter from './routes/transactions';
import insightsRouter from './routes/insights';
import settingsRouter from './routes/settings';
import { prisma } from './db/prisma';
import diagRouter from './routes/diag';
import { safeError } from './utils/redact';
import categoriesRouter from './routes/categories';
import summaryRouter from './routes/summary';
import { devAuthBypass } from './middleware/devAuthBypass';

const app = express();
export { app };

const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json());
app.use(devAuthBypass);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'nimbus-backend' });
});

app.get('/api/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'connected' });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('DB health check failed:', e?.message || e);
    res.status(500).json({ ok: false, db: 'disconnected', error: e?.message || 'Unknown DB error' });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/csv', csvRouter);
app.use('/api', providersRouter);
app.use('/api', adaptersRouter);
app.use('/api', importsRouter);
app.use('/api', transactionsRouter);
app.use('/api', insightsRouter);
app.use('/api', settingsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/summary', summaryRouter);
app.use('/', diagRouter);

const PORT = parseInt(process.env.PORT || '4000', 10);

async function start() {
  try {
    await prisma.$connect();
    // eslint-disable-next-line no-console
    console.log('Database connected successfully');
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('Failed to connect to database:', safeError(e));
  }
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Nimbus backend listening on http://localhost:${PORT}`);
  });
}

start();


