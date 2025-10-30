import path from 'node:path';
import fs from 'node:fs';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../server';

const FIX = path.join(process.cwd(), '..', 'parser-de', 'src', 'fixtures');

describe('imports API', () => {
  it('imports a valid CSV', async () => {
    const file = fs.readFileSync(path.join(FIX, 'dkb_sample.csv'));
    const res = await request(app).post('/api/imports/csv').attach('file', file, 'dkb.csv');
    expect(res.status).toBe(200);
    expect(res.body.adapterId).toMatch(/de_|eu_/);
    expect(res.body.imported).toBeGreaterThan(0);
  });

  it('rejects unknown content gracefully', async () => {
    const bad = Buffer.from('hello;world\n1;2', 'utf8');
    const res = await request(app).post('/api/imports/csv').attach('file', bad, 'bad.bin');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});


