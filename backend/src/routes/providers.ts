import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { NordigenProvider } from '../providers/nordigen';
import { FinApiProvider } from '../providers/finapi';
import { TinkProvider } from '../providers/tink';
import { requirePlanForConnections } from '../middleware/plan';

const router = express.Router();
const prisma = new PrismaClient();

function getProvider(name: string) {
  switch (name) {
    case 'nordigen':
      return new NordigenProvider();
    case 'finapi':
      return new FinApiProvider();
    case 'tink':
      return new TinkProvider();
    default:
      throw new Error(`Unsupported provider: ${name}`);
  }
}


router.post('/providers/:provider/connect', requireAuth, requirePlanForConnections(), async (req: AuthRequest, res) => {
  try {
    const provider = getProvider(req.params.provider);
    const result = await provider.startOAuth(req.userId!);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to start OAuth' });
  }
});

router.get('/providers/:provider/callback', requireAuth, requirePlanForConnections(), async (req: AuthRequest, res) => {
  try {
    const provider = getProvider(req.params.provider);
    const result = await provider.handleOAuthCallback(req.query as any);
    const tokenCreate: any = {
      accessTokenEnc: result.accessTokenEnc,
      refreshTokenEnc: (result as any).refreshTokenEnc,
      expiresAt: (result as any).expiresAt,
    };
    const providerAccount = await prisma.providerAccount.create({
      data: {
        userId: req.userId!,
        provider: result.providerAccount.provider,
        providerAccountId: result.providerAccount.providerAccountId,
        institutionName: result.providerAccount.institutionName,
        mask: result.providerAccount.mask,
        tokens: { create: tokenCreate },
      }
    });
    await prisma.syncJob.create({ data: { providerAccountId: providerAccount.id, status: 'queued' } });
    res.json({ success: true, account: providerAccount });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'OAuth callback failed' });
  }
});

router.post('/providers/:providerAccountId/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    const job = await prisma.syncJob.create({ data: { providerAccountId: req.params.providerAccountId, status: 'queued' } });
    res.json({ jobId: job.id, status: 'queued' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to create sync job' });
  }
});

router.get('/providers/accounts', requireAuth, async (req: AuthRequest, res) => {
  try {
    const accounts = await prisma.providerAccount.findMany({ where: { userId: req.userId! }, include: { tokens: true, jobs: { orderBy: { createdAt: 'desc' }, take: 5 } } });
    res.json({ accounts });
  } catch (error: any) {
    res.status(200).json({ accounts: [] });
  }
});

export default router;


