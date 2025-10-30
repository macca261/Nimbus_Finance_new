import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRouter from './routes/auth';
import csvRouter from './routes/csv';
import providersRouter from './routes/providers';
import { prisma } from './db/prisma';

const app = express();

app.use(cors({ origin: ['http://localhost:5173'], credentials: true }));
app.use(express.json());

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

const PORT = parseInt(process.env.PORT || '4000', 10);

async function start() {
  try {
    await prisma.$connect();
    // eslint-disable-next-line no-console
    console.log('Database connected successfully');
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('Failed to connect to database:', e?.message || e);
  }
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Nimbus backend listening on http://localhost:${PORT}`);
  });
}

start();


