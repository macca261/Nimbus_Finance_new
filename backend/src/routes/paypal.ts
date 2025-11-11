import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { parsePaypalCsv } from '../paypal/parser';
import { normalizePaypalTransactions } from '../paypal/normalizer';
import { categorize } from '../categorization';
import { getAllOverrideRules, db as defaultDb } from '../db';
import { findMatchingOverride } from '../overrides/userOverrides';
import { persistTransactions } from '../services/importCsv';
import { runTransferMatching } from '../services/transferMatching';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const paypalRouter = Router();

const handlePaypalImport: RequestHandler = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Keine Datei übermittelt.' });
    }

    const csv = req.file.buffer.toString('utf8');
    const accountId = typeof req.query.accountId === 'string' ? req.query.accountId : 'paypal:default';
    const profile = typeof req.query.profile === 'string' ? req.query.profile : 'paypal';

    const transactions = parsePaypalCsv(csv, { accountId, profile });
    if (!transactions.length) {
      return res.status(400).json({ error: 'Keine gültigen PayPal-Umsätze erkannt.' });
    }

    const db = (req.app as any)?.locals?.db ?? defaultDb;
    const overrideRules = getAllOverrideRules(db);

    const categorized = transactions.map(tx => {
      const overrideMatch = findMatchingOverride(tx, overrideRules);
      const category = categorize({
        text: [tx.payee ?? '', tx.memo ?? ''].filter(Boolean).join(' '),
        amount: tx.amountCents / 100,
        amountCents: tx.amountCents,
        memo: tx.memo,
        payee: tx.payee,
        source: tx.source,
        transaction: tx,
        overrideMatch: overrideMatch ? { ruleId: overrideMatch.rule.id, categoryId: overrideMatch.categoryId } : undefined,
      });
      tx.categoryId = category.category;
      tx.confidence = category.confidence;
      return { tx, category };
    });

    const normalized = normalizePaypalTransactions(categorized);

    const diagnostics = persistTransactions({
      profileId: profile,
      confidence: 1,
      filename: req.file.originalname ?? 'paypal.csv',
      transactions: normalized,
      db,
    });

    const links = runTransferMatching(db);

    return res.json({
      ok: true,
      diagnostics,
      transferLinks: links,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return res.status(500).json({ error: 'PayPal-Import fehlgeschlagen', details: message });
  }
};

paypalRouter.post('/', upload.single('file'), handlePaypalImport);
