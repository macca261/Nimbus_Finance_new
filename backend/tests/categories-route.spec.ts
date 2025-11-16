import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server';
import { db } from '../src/db';

const app = createApp({ db });

describe('/api/categories', () => {
  it('returns list of categories', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.count).toBeGreaterThan(0);

    // Check that expected categories are present
    const categoryIds = res.body.items.map((c: any) => c.id);
    expect(categoryIds).toContain('groceries');
    expect(categoryIds).toContain('other');

    // Check structure of a category
    const groceries = res.body.items.find((c: any) => c.id === 'groceries');
    expect(groceries).toBeDefined();
    expect(groceries).toHaveProperty('id');
    expect(groceries).toHaveProperty('labelDe');
    expect(typeof groceries.labelDe).toBe('string');
  });
});

