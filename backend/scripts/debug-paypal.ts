import fs from 'node:fs';
import path from 'node:path';

import { PayPalParseError } from '../src/parser/paypal';
import { parseBankCsv } from '../src/parser/parseBankCsv';

async function main(): Promise<void> {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: ts-node scripts/debug-paypal.ts <path-to-paypal.csv>');
    process.exit(1);
  }

  const absPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absPath)) {
    console.error('[debug-paypal] file not found:', absPath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(absPath);

  console.log('[debug-paypal] path =', absPath);
  console.log('[debug-paypal] size bytes =', buffer.length);
  try {
    const result = await parseBankCsv(buffer);
    console.log('[debug-paypal] profileId:', result.profileId);
    console.log('[debug-paypal] confidence:', result.confidence);
    console.log('[debug-paypal] rows:', result.rows.length);
    console.log('[debug-paypal] openingBalance:', result.openingBalance ?? null);
    console.log('[debug-paypal] closingBalance:', result.closingBalance ?? null);
    console.log('[debug-paypal] first rows snapshot:');
    result.rows.slice(0, 5).forEach((row, idx) => {
      console.log(`[debug-paypal] row ${idx + 1}`, {
        bookingDate: row.bookingDate,
        valutaDate: row.valutaDate,
        amountCents: row.amountCents,
        currency: row.currency,
        direction: row.direction,
        externalId: row.raw?.externalId,
        rawStatus: row.raw?.rawStatus,
        categoryHint: row.raw?.categoryHint,
      });
    });
  } catch (error) {
    if (error instanceof PayPalParseError) {
      console.error('[debug-paypal] PayPalParseError:', error.message, error.details ?? '');
    } else {
      console.error('[debug-paypal] Unexpected error:', error);
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error('[debug-paypal] fatal', error);
  process.exit(1);
});

