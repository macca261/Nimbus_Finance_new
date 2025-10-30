import { Router } from 'express';
import multer from 'multer';
import { decodeCsvBuffer } from '../utils/decode';
import { parseCamt053 } from '../ingest/camt';
import { normalizeCsvToCanonical } from '../csv/normalizer';
import { prisma } from '../db/prisma';
import { sha256 } from '../utils/hash';
import { computeStableTxId } from '../providers/abstract';
import { parseCsvToTable, normalizeTable } from '../ingest/csv-normalizer';
import { categorizeText } from '../services/categorizer';

const router = Router();
const maxMb = parseInt(process.env.MAX_UPLOAD_MB || '20', 10);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxMb * 1024 * 1024 } });

router.post('/imports/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const csvText = decodeCsvBuffer(req.file.buffer);

    // Try adapter-based normalization
    const norm = normalizeCsvToCanonical(csvText);

    if (!norm.adapter) {
      // Unknown format → wizard
      const table = parseCsvToTable(csvText);
      const normalized = normalizeTable(table);
      const sample = normalized.rows.slice(0, 5);
      return res.json({ needsMapping: true, headers: normalized.headersOriginal, sample });
    }

    const fileHash = sha256(req.file.buffer);
    const bankName = norm.adapter?.bankName || 'generic';
    // find or create account per bank
    let account = await prisma.account.findFirst({ where: { institution: bankName } });
    if (!account) account = await prisma.account.create({ data: { name: 'Default', institution: bankName } });
    // import record (idempotent by fileHash)
    let imp;
    try {
      imp = await prisma.import.create({ data: { accountId: account.id, bankAdapter: bankName, fileHash } });
    } catch {
      imp = await prisma.import.findFirst({ where: { fileHash } });
    }

    const rows = norm.rows;
    if (!rows.length) return res.status(422).json({ error: 'No transactions found', adapterId: norm.adapter?.id || null, imported: 0 });

    // Build stable IDs
    const candidates = rows.map((r) => ({
      bookingDate: r.booking_date,
      valueDate: r.value_date,
      amount: r.amount,
      currency: r.currency ?? 'EUR',
      purpose: r.purpose ?? '',
      endToEndId: undefined as string | undefined,
      mandateRef: undefined as string | undefined,
      counterpartName: r.counterpart_name,
    }));

    const stableIds = candidates.map((c) =>
      computeStableTxId({
        accountId: account!.id,
        bookingDate: c.bookingDate,
        valueDate: c.valueDate,
        amount: c.amount,
        currency: c.currency,
        purpose: c.purpose,
        endToEndId: c.endToEndId,
        mandateRef: c.mandateRef,
        counterpartName: c.counterpartName,
      } as any)
    );

    // Fetch existing by recurrenceKey (used to store stableId)
    const existing = await prisma.transaction.findMany({
      where: { accountId: account.id, recurrenceKey: { in: stableIds } },
      select: { id: true, recurrenceKey: true, bookingDate: true, valueDate: true, amount: true, currency: true, purpose: true },
    });
    const existingByKey = new Map(existing.map(e => [e.recurrenceKey as string, e]));

    const toCreate: any[] = [];
    const toUpdate: { id: string; data: any }[] = [];
    let duplicates = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i++) {
      try {
        const r = rows[i];
        const key = stableIds[i];
        const found = existingByKey.get(key);
        const data = {
          accountId: account.id,
          importId: imp!.id,
          bookingDate: r.booking_date,
          valueDate: r.value_date,
          amount: r.amount,
          currency: r.currency ?? 'EUR',
          purpose: r.purpose,
          counterpartName: r.counterpart_name,
          recurrenceKey: key,
        };
        if (!found) {
          toCreate.push(data);
        } else {
          // compare and update if changed
          const same =
            found.bookingDate === data.bookingDate &&
            (found.valueDate ?? null) === (data.valueDate ?? null) &&
            Number(found.amount) === Number(data.amount) &&
            (found.currency ?? 'EUR') === (data.currency ?? 'EUR') &&
            (found.purpose ?? '') === (data.purpose ?? '');
          if (same) {
            duplicates++;
          } else {
            toUpdate.push({ id: found.id, data });
          }
        }
      } catch {
        errors++;
      }
    }

    let created = 0;
    if (toCreate.length) {
      const resCreate = await prisma.transaction.createMany({ data: toCreate });
      created = resCreate.count;
      // add AIInference for created ones (best-effort)
      const createdRows = rows.filter((_r, idx) => !existingByKey.get(stableIds[idx]));
      for (const r of createdRows.slice(0, 200)) { // limit for perf
        const explain = categorizeText(`${r.counterpart_name ?? ''} ${r.purpose ?? ''}`, r.amount);
        try {
          const tx = await prisma.transaction.findFirst({ where: { accountId: account.id, bookingDate: r.booking_date, amount: r.amount, purpose: r.purpose } });
          if (tx) {
            await prisma.aIInference.create({
              data: {
                transactionId: tx.id,
                model: explain.model || (explain.method === 'rule' ? 'rules:v1' : explain.method === 'ml' ? 'ml:v1' : 'ai:gpt'),
                suggestionCategoryId: explain.category,
                confidence: explain.confidence,
                reasonJson: JSON.stringify({ reason: explain.reason, hits: explain.hits || [], patterns: explain.patterns || [] })
              }
            });
          }
        } catch { /* ignore */ }
      }
    }
    let updated = 0;
    for (const u of toUpdate) {
      await prisma.transaction.update({ where: { id: u.id }, data: u.data });
      updated++;
    }

    return res.json({ adapterId: norm.adapter?.id || null, imported: created, updated, duplicates, errors });
  } catch (e: any) {
    return res.status(400).json({ error: 'Failed to import CSV' });
  }
});

export default router;

// CAMT import
router.post('/imports/camt', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const xml = req.file.buffer.toString('utf8');
    const parsed = parseCamt053(xml);
    const bankName = parsed.bankName || 'camt_bank';

    let account = await prisma.account.findFirst({ where: { institution: bankName } });
    if (!account) account = await prisma.account.create({ data: { name: 'Default', institution: bankName } });
    const fileHash = sha256(req.file.buffer);
    let imp;
    try { imp = await prisma.import.create({ data: { accountId: account.id, bankAdapter: bankName, fileHash } }); } catch { imp = await prisma.import.findFirst({ where: { fileHash } }); }

    const candidates = parsed.rows;
    const stableIds = candidates.map(c => computeStableTxId({
      accountId: account!.id,
      bookingDate: c.bookingDate,
      valueDate: c.bookingDate,
      amount: c.amount,
      currency: c.currency || 'EUR',
      purpose: c.purpose || '',
      endToEndId: c.endToEndId,
      mandateRef: c.mandateRef,
    } as any));

    const existing = await prisma.transaction.findMany({ where: { accountId: account.id, recurrenceKey: { in: stableIds } }, select: { id: true, recurrenceKey: true, bookingDate: true, amount: true, currency: true, purpose: true } });
    const existingByKey = new Map(existing.map(e => [e.recurrenceKey as string, e]));
    const toCreate: any[] = [];
    const toUpdate: { id: string; data: any }[] = [];
    let duplicates = 0;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const key = stableIds[i];
      const found = existingByKey.get(key);
      const data = {
        accountId: account.id,
        importId: imp!.id,
        bookingDate: c.bookingDate,
        amount: c.amount,
        currency: c.currency || 'EUR',
        purpose: c.purpose,
        recurrenceKey: key,
        endToEndId: c.endToEndId,
        mandateRef: c.mandateRef,
        creditorId: c.creditorId,
      };
      if (!found) toCreate.push(data);
      else {
        const same = found.bookingDate === data.bookingDate && Number(found.amount) === Number(data.amount) && (found.currency ?? 'EUR') === (data.currency ?? 'EUR') && (found.purpose ?? '') === (data.purpose ?? '');
        if (same) duplicates++; else toUpdate.push({ id: found.id, data });
      }
    }
    let created = 0, updated = 0;
    if (toCreate.length) created = (await prisma.transaction.createMany({ data: toCreate })).count;
    for (const u of toUpdate) { await prisma.transaction.update({ where: { id: u.id }, data: u.data }); updated++; }
    return res.json({ new: created, updated, duplicates, errors: 0 });
  } catch (e: any) {
    return res.status(400).json({ error: 'Failed to import CAMT', details: e?.message || 'Unknown error' });
  }
});


