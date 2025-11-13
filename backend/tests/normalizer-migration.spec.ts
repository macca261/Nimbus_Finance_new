import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '../src/db';

type DbRuleRow = {
  id: string;
  is_active: number;
  priority: number;
  matcher: string;
  pattern: string;
  normalizeTo: string;
  categoryHint?: string | null;
};

describe('normalizer migration', () => {
  beforeEach(() => {
    db.exec('DELETE FROM normalization_rules');
  });

  it('persists and reads normalization rules', () => {
    db.prepare(
      `INSERT INTO normalization_rules (id, matcher, pattern, normalizeTo, priority, categoryHint)
       VALUES (@id, @matcher, @pattern, @normalizeTo, @priority, @categoryHint)`,
    ).run({
      id: 'rule-1',
      matcher: 'contains',
      pattern: 'uber',
      normalizeTo: 'Uber',
      priority: 5,
      categoryHint: 'mobilität.taxi_ridehail',
    });

    const rows = db
      .prepare<unknown[], DbRuleRow>(`
        SELECT id, is_active, priority, matcher, pattern, normalizeTo, categoryHint
        FROM normalization_rules
        ORDER BY priority ASC, createdAt ASC
      `)
      .all();

    expect(rows).toHaveLength(1);
    const [first] = rows;
    expect(first).toMatchObject({
      id: 'rule-1',
      matcher: 'contains',
      pattern: 'uber',
      normalizeTo: 'Uber',
      priority: 5,
    });
    expect(first.is_active).toBe(1);
    expect(first.categoryHint).toBe('mobilität.taxi_ridehail');
  });

  it('orders rules by priority ascending, then createdAt', async () => {
    const insert = db.prepare(
      `INSERT INTO normalization_rules (id, matcher, pattern, normalizeTo, priority)
       VALUES (?, ?, ?, ?, ?)`,
    );
    insert.run('rule-high', 'contains', 'alpha', 'Alpha', 50);
    insert.run('rule-low', 'contains', 'beta', 'Beta', 5);

    const rows = db
      .prepare<unknown[], DbRuleRow>(`
        SELECT id, is_active, priority
        FROM normalization_rules
        ORDER BY priority ASC, createdAt ASC
      `)
      .all();

    expect(rows.map(row => row.id)).toEqual(['rule-low', 'rule-high']);
    expect(rows.every(row => row.is_active === 1)).toBe(true);
  });
});


