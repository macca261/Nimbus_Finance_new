import { Router } from 'express';
import multer from 'multer';
import { parseTransactions } from '../csv/parser';
import { normalizeCsvToCanonical } from '../csv/normalizer';
import { categorize } from '../services/categorization.service';
import { decodeCsvBuffer } from '../utils/decode';
import { prisma } from '../db/prisma';
import { sha256 } from '../utils/hash';
import type { AuthRequest } from '../middleware/authMiddleware';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/upload', requireAuth, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const csvText = decodeCsvBuffer(req.file.buffer);
    const normalized = normalizeCsvToCanonical(csvText);
    if (!normalized.rows.length) {
      // fallback to previous parser if adapter failed
      const { bank, transactions } = parseTransactions(csvText);
      if (!transactions.length) {
        return res.status(422).json({ error: 'No transactions found', details: 'Parsed 0 rows. Check file encoding/export format.' });
      }
      const enriched = transactions.map((t, idx) => {
        const cat = categorize(`${t.merchant ?? ''} ${t.description}`, t.amount);
        return { id: `${Date.now()}_${idx}`, ...t, category: cat.category, confidence: cat.confidence };
      });
      return res.json({ ok: true, bank, filename: req.file.originalname, sizeBytes: req.file.size, numRows: enriched.length, headers: [], transactions: enriched });
    }

    // Persist import + transactions (canonical)
    const fileHash = sha256(req.file.buffer);
    // Use or create a default account per bank
    const bankName = normalized.adapter?.bankName || 'generic';
    let account = await prisma.account.findFirst({ where: { institution: bankName } });
    if (!account) {
      account = await prisma.account.create({ data: { name: 'Default', institution: bankName } });
    }
    // Create import (ignore unique fileHash errors)
    let imp;
    try {
      imp = await prisma.import.create({ data: { accountId: account.id, bankAdapter: normalized.adapter?.bankName, fileHash } });
    } catch {
      imp = await prisma.import.findFirst({ where: { fileHash } });
    }

    const created = [] as any[];
    for (const row of normalized.rows.slice(0, 1000)) {
      if (!row.booking_date || Number.isNaN(row.amount)) continue; // skip malformed
      try {
        const cat = categorize(`${row.counterpart_name ?? ''} ${row.purpose ?? ''}`, row.amount);
        const tx = await prisma.transaction.create({
          data: {
            accountId: account.id,
            importId: imp!.id,
            bookingDate: row.booking_date,
            valueDate: row.value_date,
            amount: row.amount,
            currency: row.currency ?? 'EUR',
            purpose: row.purpose,
            counterpartName: row.counterpart_name,
            categoryId: cat.category,
            categoryConfidence: cat.confidence,
          }
        });
        created.push({
          id: tx.id,
          date: tx.bookingDate,
          amount: Number(tx.amount),
          description: tx.purpose ?? '',
          merchant: tx.counterpartName ?? undefined,
          category: tx.categoryId ?? 'Other',
          confidence: tx.categoryConfidence ?? 0.5,
        });
      } catch {
        // skip problematic rows
      }
    }

    return res.json({ ok: true, bank: bankName, filename: req.file.originalname, sizeBytes: req.file.size, numRows: created.length, headers: [], transactions: created });
  } catch (err: any) {
    return res.status(400).json({ error: 'Failed to parse CSV', details: err?.message || 'Unknown error' });
  }
});

export default router;


