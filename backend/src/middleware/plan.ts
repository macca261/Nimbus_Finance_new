import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './authMiddleware';
import { prisma } from '../db/prisma';

const CONNECTION_LIMIT: Record<string, number> = {
  free: 0,
  pro_lite: 1,
  pro_plus: 3,
};

export function requirePlanForConnections() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
      const sub = await prisma.subscription.findUnique({ where: { userId: req.userId } });
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      const plan = (sub?.plan || user?.tier || 'free').toLowerCase();
      const limit = CONNECTION_LIMIT[plan] ?? 0;
      if (limit <= 0) return res.status(403).json({ error: 'Upgrade required', message: 'Bank connections are not available on Free tier.' });
      const count = await prisma.providerAccount.count({ where: { userId: req.userId } });
      if (count >= limit) return res.status(403).json({ error: 'Connection limit reached', message: `Your plan allows ${limit} connection(s).` });
      next();
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Plan check failed' });
    }
  };
}


