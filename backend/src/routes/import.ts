import { Router } from 'express';
import multer from 'multer';
import type { BankId } from '@nimbus/parsers-de';
import { parseTransactions } from '@nimbus/parsers-de';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
export const importRouter = Router();

importRouter.post('/', upload.single('file'), async (req, res) => {
  try {
    const buf = req.file?.buffer;
    if (!buf) return res.status(400).json({ error: 'file missing' });

    const hinted = (req.query.bank as BankId | undefined);
    const transactions = parseTransactions(buf, hinted);
    const bank = transactions[0]?.bank ?? hinted ?? 'unknown';

    res.json({ bank, count: transactions.length, transactions });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'parse failed' });
  }
});

