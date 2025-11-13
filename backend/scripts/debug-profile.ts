import fs from 'node:fs';
import path from 'node:path';

import { parseWithProfile } from '../src/parsing/profileEngine';
import type { ParserProfile } from '../src/parsing/profileTypes';
import { ingProfile } from '../src/parsing/profiles/ing';
import { dkbProfile } from '../src/parsing/profiles/dkb';
import { sparkasseProfile } from '../src/parsing/profiles/sparkasse';
import { commerzbankProfile } from '../src/parsing/profiles/commerzbank';

const PROFILE_MAP: Record<string, ParserProfile> = {
  ing: ingProfile,
  dkb: dkbProfile,
  sparkasse: sparkasseProfile,
  commerzbank: commerzbankProfile,
};

async function main() {
  const profileId = process.argv[2];
  const fileArg = process.argv[3];

  if (!profileId) {
    console.error('Usage: ts-node ./scripts/debug-profile.ts <profileId> [csvPath]');
    console.error(`Known profiles: ${Object.keys(PROFILE_MAP).join(', ')}`);
    process.exit(1);
  }

  const profile = PROFILE_MAP[profileId];
  if (!profile) {
    console.error(`Unknown profile "${profileId}". Known profiles: ${Object.keys(PROFILE_MAP).join(', ')}`);
    process.exit(1);
  }

  if (!fileArg) {
    console.error('Please provide a CSV file path to debug.');
    process.exit(1);
  }

  const csvPath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  try {
    const buffer = fs.readFileSync(csvPath);
    const result = parseWithProfile(buffer, profile);

    console.log(`Profile: ${result.profileId}`);
    console.log(`Rows parsed: ${result.rows.length}`);
    if (typeof result.openingBalance === 'number' || typeof result.closingBalance === 'number') {
      console.log(
        `Balances => opening: ${
          result.openingBalance !== undefined ? result.openingBalance : 'n/a'
        }, closing: ${result.closingBalance !== undefined ? result.closingBalance : 'n/a'}`,
      );
    }

    result.rows.slice(0, 2).forEach((row, idx) => {
      console.log(
        `#${idx + 1}: ${row.bookingDate} | ${row.amountCents} ${row.currency} | ${row.direction} | ${row.rawText}`,
      );
    });
  } catch (error) {
    console.error('Failed to parse CSV with profile engine.', error);
    process.exit(1);
  }
}

void main();


