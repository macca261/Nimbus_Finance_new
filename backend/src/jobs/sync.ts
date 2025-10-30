import { PrismaClient } from '@prisma/client';
import { computeStableTxId } from '../providers/abstract';
import { CategorizationService } from '../services/categorization';
import { NordigenProvider } from '../providers/nordigen';

const prisma = new PrismaClient();
const categorizer = new CategorizationService();

export class SyncEngine {
  async runNextSyncJob() {
    const job = await prisma.syncJob.findFirst({
      where: { status: 'queued' },
      include: { account: { include: { tokens: true } } }
    });
    if (!job) return;

    try {
      await prisma.syncJob.update({ where: { id: job.id }, data: { status: 'running', startedAt: new Date() } });

      const provider = this.getProvider(job.account.provider);
      const token = job.account.tokens[0];
      const cursor = await prisma.syncCursor.findFirst({ where: { providerAccountId: job.account.id } });

      const result = await provider.fetchTransactions({
        accessTokenEnc: token.accessTokenEnc,
        providerAccountId: job.account.providerAccountId,
        since: cursor?.sinceCursor
      });

      // Ensure an Import record exists for provider sync linkage
      const adapterKey = `provider:${job.account.provider}`;
      let imp = await prisma.import.findFirst({ where: { accountId: job.account.id, bankAdapter: adapterKey } });
      if (!imp) {
        imp = await prisma.import.create({ data: { accountId: job.account.id, bankAdapter: adapterKey } });
      }

      for (const tx of result.transactions) {
        const stableId = computeStableTxId({ ...tx, accountId: job.account.id });
        const categorization = await categorizer.categorizeTransaction(tx);

        await prisma.transaction.upsert({
          where: { id: stableId },
          create: {
            id: stableId,
            accountId: job.account.id,
            importId: imp.id,
            bookingDate: tx.bookingDate,
            valueDate: tx.valueDate,
            amount: tx.amount,
            currency: tx.currency,
            txType: tx.txType,
            counterpartName: tx.counterpartName,
            counterpartIban: tx.counterpartIban,
            counterpartBic: tx.counterpartBic,
            mandateRef: tx.mandateRef,
            creditorId: tx.creditorId,
            endToEndId: tx.endToEndId,
            purpose: tx.purpose,
            rawCode: tx.rawCode,
            mcc: tx.mcc,
            merchantId: tx.merchantId,
            categoryId: categorization.category,
            categoryConfidence: categorization.confidence,
          },
          update: {
            amount: tx.amount,
            purpose: tx.purpose,
            counterpartName: tx.counterpartName,
            categoryId: categorization.category,
            categoryConfidence: categorization.confidence,
          }
        });

        if (categorization.method === 'ai') {
          await prisma.aIInference.create({
            data: {
              transactionId: stableId,
              model: categorization.model || 'gpt-4',
              suggestionCategoryId: categorization.category,
              confidence: categorization.confidence,
              reasonJson: categorization.reason ? JSON.stringify({ reason: categorization.reason }) : undefined,
            }
          });
        }
      }

      if (result.nextCursor) {
        await prisma.syncCursor.upsert({
          where: { providerAccountId_accountId: { providerAccountId: job.account.id, accountId: job.account.id } },
          create: { providerAccountId: job.account.id, accountId: job.account.id, sinceCursor: result.nextCursor },
          update: { sinceCursor: result.nextCursor }
        });
      }

      await prisma.syncJob.update({ where: { id: job.id }, data: { status: 'done', finishedAt: new Date() } });
    } catch (error: any) {
      await prisma.syncJob.update({ where: { id: job.id }, data: { status: 'error', finishedAt: new Date(), error: error?.message || 'Unknown error' } });
    }
  }

  private getProvider(providerName: string) {
    switch (providerName) {
      case 'nordigen':
      default:
        return new NordigenProvider();
    }
  }
}


