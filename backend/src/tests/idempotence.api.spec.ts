import path from 'node:path';
import fs from 'node:fs';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../server';

const FIX = path.join(process.cwd(), '..', 'parser-de', 'src', 'fixtures');

describe('API import dedupe', () => {
  it('second import yields 0 new rows', async () => {
    const file = fs.readFileSync(path.join(FIX, 'sparkasse_sample.csv'));
    const res1 = await request(app).post('/api/imports/csv').attach('file', file, 's.csv');
    expect(res1.status).toBe(200);
    const res2 = await request(app).post('/api/imports/csv').attach('file', file, 's.csv');
    expect(res2.status).toBe(200);
    expect((res2.body?.new ?? 0)).toBe(0);
  });
});


