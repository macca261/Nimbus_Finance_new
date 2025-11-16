/* eslint-disable no-console */

import { readFileSync } from 'fs';

import { resolve } from 'path';

import { parseBankCsv } from '../src/parser/parseBankCsv';

function usage(): never {

  console.error('Usage: npm -w backend run debug:bank -- <path-to-csv>');

  process.exit(1);

}

async function main() {

  const [, , fileArg] = process.argv;

  if (!fileArg) {

    usage();

  }

  const path = resolve(process.cwd(), fileArg);

  const buffer = readFileSync(path);

  console.log(`\n[debug-bank] Parsing file: ${path}\n`);

  const result = parseBankCsv(buffer);

  console.log('Detected profileId:', result.profileId);

  console.log('Confidence:', result.confidence);

  console.log('Candidates:', result.candidates);

  console.log('Row count:', result.rows.length);

  console.log('Warnings:', result.warnings);

  const sampleCount = Math.min(result.rows.length, 5);

  console.log(`\nFirst ${sampleCount} normalized rows:\n`);

  for (let i = 0; i < sampleCount; i++) {

    const row = result.rows[i];

    console.log(

      JSON.stringify(

        {

          i,

          bookingDate: row.bookingDate,

          valutaDate: row.valutaDate,

          amountCents: row.amountCents,

          direction: row.direction,

          currency: row.currency,

          externalId: row.externalId,

          accountId: row.accountId,

          counterparty: row.counterparty,

          rawText: row.rawText,

        },

        null,

        2,

      ),

    );

    console.log('---');

  }

}

main().catch((err) => {

  console.error('[debug-bank] ERROR:', err);

  process.exit(1);

});

