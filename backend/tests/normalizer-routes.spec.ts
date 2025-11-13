import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/server';
import { db } from '../src/db';
import { clearRulesCache } from '../src/normalizer/engine';

const app = createApp({ db });

const insertRule = db.prepare(
  `INSERT INTO normalization_rules (id, matcher, pattern, normalizeTo, priority, is_active)
   VALUES (?, ?, ?, ?, ?, ?)`,
);

describe('normalizer routes', () => {
  beforeEach(() => {
    db.exec('DELETE FROM normalization_rules');
    clearRulesCache();
  });

  it('lists, creates, updates, tests and deletes rules', async () => {
    // create first rule
    const createResA = await request(app)
      .post('/api/normalizer/rules')
      .send({
        matcher: 'contains',
        pattern: 'uber',
        normalizeTo: 'Uber',
        priority: 30,
        categoryHint: 'mobilität.taxi_ridehail',
      });
    expect(createResA.status).toBe(201);
    expect(createResA.body?.rule?.normalizeTo).toBe('Uber');
    const idA = createResA.body?.rule?.id;
    expect(typeof idA).toBe('string');

    // create second rule with higher priority and different matcher
    const createResB = await request(app)
      .post('/api/normalizer/rules')
      .send({
        matcher: 'startsWith',
        pattern: 'uber',
        normalizeTo: 'Uber Start',
        priority: 10,
      });
    expect(createResB.status).toBe(201);
    const idB = createResB.body?.rule?.id;

    const listRes = await request(app).get('/api/normalizer/rules');
    expect(listRes.status).toBe(200);
    expect(listRes.body?.rules.map((r: any) => r.id)).toEqual([idB, idA]);

    const updateRes = await request(app)
      .put(`/api/normalizer/rules/${idA}`)
      .send({ normalizeTo: 'Uber Updated', priority: 15, isActive: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body?.rule?.normalizeTo).toBe('Uber Updated');
    expect(updateRes.body?.rule?.is_active).toBe(false);

    const testRes = await request(app)
      .post('/api/normalizer/test')
      .send({ text: 'Uber BV Fahrt 123' });
    expect(testRes.status).toBe(200);
    expect(testRes.body?.result?.merchant).toBe('Uber Start');

    const deleteRes = await request(app)
      .delete('/api/normalizer/rules')
      .send({ ids: [idA, idB] });
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body?.deleted).toBe(2);

    const afterDelete = await request(app).get('/api/normalizer/rules');
    expect(afterDelete.body?.rules).toHaveLength(0);
  });

  it('rejects invalid payloads and duplicate rules', async () => {
    const invalidMatcher = await request(app)
      .post('/api/normalizer/rules')
      .send({ matcher: 'invalid', pattern: 'zz', normalizeTo: 'X' });
    expect(invalidMatcher.status).toBe(400);

    const ok = await request(app)
      .post('/api/normalizer/rules')
      .send({ matcher: 'contains', pattern: 'abc', normalizeTo: 'ABC' });
    expect(ok.status).toBe(201);
    const id = ok.body?.rule?.id;

    const duplicate = await request(app)
      .post('/api/normalizer/rules')
      .send({ matcher: 'contains', pattern: 'abc', normalizeTo: 'ABC' });
    expect(duplicate.status).toBe(400);

    const noChanges = await request(app)
      .put(`/api/normalizer/rules/${id}`)
      .send({});
    expect(noChanges.status).toBe(400);

    insertRule.run('existing', 'equals', 'foo', 'Foo', 20, 1);
    const duplicateUpdate = await request(app)
      .put(`/api/normalizer/rules/${id}`)
      .send({ matcher: 'equals', pattern: 'foo', normalizeTo: 'Foo' });
    expect(duplicateUpdate.status).toBe(400);
  });
});


