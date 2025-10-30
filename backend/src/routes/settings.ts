import { Router } from 'express';
import archiver from 'archiver';
import { prisma } from '../db/prisma';
import type { AuthRequest } from '../middleware/authMiddleware';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/settings/export', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="nimbus-export.zip"');

    const archive = archiver('zip');
    archive.on('error', (err) => { throw err; });
    archive.pipe(res);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const subscriptions = await prisma.subscription.findMany({ where: { userId } });
    const usage = await prisma.usageCounter.findMany({ where: { userId } });
    const providerAccounts = await prisma.providerAccount.findMany({ where: { userId }, include: { tokens: true, cursors: true, jobs: true } });
    const accounts = await prisma.account.findMany({});
    const imports = await prisma.import.findMany({});
    const transactions = await prisma.transaction.findMany({});
    const inferences = await prisma.aIInference.findMany({});

    archive.append(JSON.stringify(user, null, 2), { name: 'user.json' });
    archive.append(JSON.stringify(subscriptions, null, 2), { name: 'subscriptions.json' });
    archive.append(JSON.stringify(usage, null, 2), { name: 'usage.json' });
    archive.append(JSON.stringify(providerAccounts, null, 2), { name: 'provider_accounts.json' });
    archive.append(JSON.stringify(accounts, null, 2), { name: 'accounts.json' });
    archive.append(JSON.stringify(imports, null, 2), { name: 'imports.json' });
    archive.append(JSON.stringify(transactions, null, 2), { name: 'transactions.json' });
    archive.append(JSON.stringify(inferences, null, 2), { name: 'ai_inferences.json' });

    await archive.finalize();
  } catch (e: any) {
    res.status(500).json({ error: 'Export failed' });
  }
});

router.post('/settings/delete', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    // Delete in order of FKs
    const provAccounts = await prisma.providerAccount.findMany({ where: { userId } });
    for (const pa of provAccounts) {
      await prisma.syncCursor.deleteMany({ where: { providerAccountId: pa.id } });
      await prisma.syncJob.deleteMany({ where: { providerAccountId: pa.id } });
      await prisma.providerToken.deleteMany({ where: { providerAccountId: pa.id } });
      await prisma.providerAccount.delete({ where: { id: pa.id } });
    }

    const accounts = await prisma.account.findMany({});
    for (const acc of accounts) {
      await prisma.aIInference.deleteMany({ where: { transaction: { accountId: acc.id } } });
      await prisma.transaction.deleteMany({ where: { accountId: acc.id } });
      await prisma.import.deleteMany({ where: { accountId: acc.id } });
      await prisma.account.delete({ where: { id: acc.id } });
    }

    await prisma.subscription.deleteMany({ where: { userId } });
    await prisma.usageCounter.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;


