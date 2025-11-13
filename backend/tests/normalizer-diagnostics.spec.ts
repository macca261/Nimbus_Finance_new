import fs from 'node:fs';
import path from 'node:path';

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/server';
import { db } from '../src/db';
import { clearRulesCache } from '../src/normalizer/engine';

const app = createApp({ db });
const fx = (...segments: string[]) => path.join(__dirname, 'fixtures', ...segments);

describe('normalizer diagnostics', () => {
  beforeEach(() => {
    db.exec('DELETE FROM normalization_rules');
    db.exec('DELETE FROM transactions');
    db.exec('DELETE FROM imports');
    clearRulesCache();
  });

  it('reports active rule count in import diagnostics', async () => {
    db.prepare(
      `INSERT INTO normalization_rules (id, matcher, pattern, normalizeTo, priority, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('diag-rule', 'contains', 'rewe', 'REWE', 10, 1);
    clearRulesCache();

    const res = await request(app)
      .post('/api/import')
      .attach('file', fs.readFileSync(fx('commerzbank_min.csv')), 'commerzbank_min.csv');

    expect(res.status).toBe(200);
    expect(res.body?.normalizerRulesActive).toBe(1);
  });
});


