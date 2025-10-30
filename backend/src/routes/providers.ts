import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { NordigenProvider } from '../providers/nordigen';

const router = express.Router();
const prisma = new PrismaClient();

function getProvider(name: string) {
  switch (name) {
    case 'nordigen':
      return new NordigenProvider();
    default:
      throw new Error(`Unsupported provider: ${name}`);
  }
}

function checkTier(requiredTier: 'free' | 'pro_lite' | 'pro_plus') {
  return async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    const sub = await prisma.subscription.findUnique({ where: { userId: req.userId } });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const tier = (sub?.plan as string | undefined) || user?.tier || 'free';
    if (tier === 'free' && requiredTier !== 'free') {
      return res.status(403).json({ error: 'Upgrade required', message: `This feature requires ${requiredTier} tier` });
    }
    next();
  };
}

router.post('/providers/:provider/connect', requireAuth, checkTier('pro_lite'), async (req: AuthRequest, res) => {
  try {
    const provider = getProvider(req.params.provider);
    const result = await provider.startOAuth(req.userId!);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to start OAuth' });
  }
});

router.get('/providers/:provider/callback', requireAuth, checkTier('pro_lite'), async (req: AuthRequest, res) => {
  try {
    const provider = getProvider(req.params.provider);
    const result = await provider.handleOAuthCallback(req.query as any);
    const providerAccount = await prisma.providerAccount.create({
      data: {
        userId: req.userId!,
        provider: result.providerAccount.provider,
        providerAccountId: result.providerAccount.providerAccountId,
        institutionName: result.providerAccount.institutionName,
        mask: result.providerAccount.mask,
        tokens: { create: { accessTokenEnc: result.accessTokenEnc, refreshTokenEnc: result.refreshTokenEnc, expiresAt: result.expiresAt } },
      }
    });
    await prisma.syncJob.create({ data: { providerAccountId: providerAccount.id, status: 'queued' } });
    res.json({ success: true, account: providerAccount });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'OAuth callback failed' });
  }
});

router.post('/providers/:providerAccountId/sync', requireAuth, checkTier('pro_lite'), async (req: AuthRequest, res) => {
  try {
    const job = await prisma.syncJob.create({ data: { providerAccountId: req.params.providerAccountId, status: 'queued' } });
    res.json({ jobId: job.id, status: 'queued' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to create sync job' });
  }
});

router.get('/providers/accounts', requireAuth, checkTier('pro_lite'), async (req: AuthRequest, res) => {
  try {
    const accounts = await prisma.providerAccount.findMany({
      where: { userId: req.userId! },
      include: { tokens: true, jobs: { orderBy: { createdAt: 'desc' }, take: 5 } }
    });
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to list accounts' });
  }
});

export default router;


