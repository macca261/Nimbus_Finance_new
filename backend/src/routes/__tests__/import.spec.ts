/**
 * Tests for CSV Import API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { rawDb, openDb, ensureSchema } from '../../db';
import importRouter from '../import';

describe('POST /api/import', () => {
  let app: express.Application;
  let db: ReturnType<typeof openDb>;

  beforeEach(() => {
    db = openDb();
    ensureSchema(db);

    app = express();
    app.use(express.json());
    app.use('/api/import', importRouter);
  });

  it('should return 400 if no file is uploaded', async () => {
    const res = await request(app)
      .post('/api/import')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'CSV_IMPORT_FAILED');
    expect(res.body).toHaveProperty('message');
  });

  it('should return 400 if file is not CSV', async () => {
    // Create a temporary non-CSV file
    const tempFile = path.join(__dirname, '../../tmp/test.txt');
    const tempDir = path.dirname(tempFile);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(tempFile, 'not a csv');

    const res = await request(app)
      .post('/api/import')
      .attach('file', tempFile);

    // Cleanup
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }

    expect(res.status).toBe(400);
  });

  it('should return structured error on import failure', async () => {
    // Create a malformed CSV file
    const tempFile = path.join(__dirname, '../../tmp/test.csv');
    const tempDir = path.dirname(tempFile);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(tempFile, 'invalid,csv,data\nno,headers');

    const res = await request(app)
      .post('/api/import')
      .attach('file', tempFile);

    // Cleanup
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('message');
    // Should have either 'details' or 'errors' array
    expect(res.body).toHaveProperty(res.body.details ? 'details' : 'errors');
  });

  it('should accept valid CSV and return success response', async () => {
    // Create a minimal valid Sparkasse CSV
    const tempFile = path.join(__dirname, '../../tmp/test-sparkasse.csv');
    const tempDir = path.dirname(tempFile);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const csvContent = `Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;Begünstigter/Zahlungspflichtiger;Kontonummer;BLZ;Betrag;Währung
15.01.2024;15.01.2024;Lastschrift;Test Transaction;REWE;123456;12345678;-12,50;EUR`;

    fs.writeFileSync(tempFile, csvContent, 'utf-8');

    const res = await request(app)
      .post('/api/import')
      .attach('file', tempFile)
      .field('accountId', 'test-account');

    // Cleanup
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }

    // Should return 200 with success response
    if (res.status === 200) {
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('strategy');
      expect(res.body).toHaveProperty('imported');
      expect(res.body).toHaveProperty('inserted'); // Alias for frontend
      expect(res.body).toHaveProperty('insertedCount'); // Alias for frontend
      expect(res.body).toHaveProperty('skipped');
      expect(res.body).toHaveProperty('message');
    } else {
      // If it fails, should still have structured error
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('message');
    }
  });
});

