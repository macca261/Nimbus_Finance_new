/**
 * Universal CSV Import Service
 * 
 * Implements the Strategy Pattern with streaming for large file support.
 * Auto-detects bank format and processes files without loading entire content into RAM.
 */

import fs from 'fs';
import { Readable } from 'stream';
import { parse } from 'csv-parse';
import iconv from 'iconv-lite';
import { ImportStrategy, NormalizedTransaction, ImportResult } from './interfaces';
import { categorize } from '../categorization';
import {
  SparkasseStrategy,
  PayPalStrategy,
  IngStrategy,
  DkbStrategy,
  N26Strategy,
  ComdirectStrategy,
  RevolutStrategy,
} from './strategies';

export class ImportService {
  private strategies: ImportStrategy[];

  constructor() {
    // Register all strategies (sorted by priority, highest first)
    this.strategies = [
      new SparkasseStrategy(),
      new PayPalStrategy(),
      new IngStrategy(),
      new DkbStrategy(),
      new N26Strategy(),
      new ComdirectStrategy(),
      new RevolutStrategy(),
    ].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Detects bank format by sniffing file headers
   */
  private async sniffFile(filePath: string): Promise<{
    headers: string[];
    detectedStrategy: ImportStrategy | null;
    delimiter: string;
  }> {
    // Read first 4KB to detect format
    const buffer = Buffer.alloc(4096);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
    fs.closeSync(fd);

    if (bytesRead === 0) {
      throw new Error('File is empty');
    }

    // Try UTF-8 first, then Latin1
    let text = '';
    let encoding: 'utf-8' | 'latin1' = 'utf-8';
    
    try {
      text = buffer.toString('utf-8');
      // Check for BOM
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
      }
    } catch {
      text = buffer.toString('latin1');
      encoding = 'latin1';
    }

    // Split into lines and find header row
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) {
      throw new Error('No data found in file');
    }

    // Detect delimiter (count semicolons vs commas in first line)
    const firstLine = lines[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount >= commaCount ? ';' : ',';

    // Parse header row
    const headerLine = lines[0];
    const headers = headerLine
      .split(delimiter)
      .map(h => h.trim().replace(/^["']|["']$/g, ''));

    // Try to match strategy
    let detectedStrategy: ImportStrategy | null = null;
    for (const strategy of this.strategies) {
      if (strategy.canParse(headers)) {
        detectedStrategy = strategy;
        break;
      }
    }

    return { headers, detectedStrategy, delimiter };
  }

  /**
   * Streams and parses CSV file with auto-detection
   */
  public async detectAndParse(filePath: string): Promise<ImportResult> {
    const { headers, detectedStrategy, delimiter } = await this.sniffFile(filePath);

    if (!detectedStrategy) {
      throw new Error(
        `Unknown bank format. Detected headers: ${headers.join(', ')}. ` +
        `Please ensure the file is from a supported bank (Sparkasse, PayPal, ING, DKB, N26, Comdirect, Revolut).`
      );
    }

    console.log(`[ImportService] Detected Bank: ${detectedStrategy.name}`);

    const results: NormalizedTransaction[] = [];
    let totalRows = 0;
    let skippedRows = 0;
    let categorizedCount = 0;

    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(filePath);
      
      // Build pipeline based on encoding
      let pipeline: Readable;
      
      if (detectedStrategy.csvOptions.encoding === 'latin1') {
        // Convert Latin1 to UTF-8
        pipeline = readStream.pipe(iconv.decodeStream('latin1'));
      } else {
        // UTF-8, no conversion needed
        pipeline = readStream;
      }

      pipeline
        .pipe(
          parse({
            delimiter: delimiter,
            skipLinesWithError: true,
            skipEmptyLines: true,
            columns: headers,
            trim: true,
            relaxColumnCount: true,
            relaxQuotes: true,
          })
        )
        .on('data', (row: Record<string, string>) => {
          totalRows++;
          
          try {
            const normalized = detectedStrategy.mapRow(row);
            
            if (!normalized) {
              skippedRows++;
              return;
            }

            // Categorize during import (fast regex-based)
            const categoryResult = categorize({
              text: `${normalized.payee} ${normalized.description}`,
              amount: normalized.amountCents / 100,
              amountCents: normalized.amountCents,
            });

            if (categoryResult.category) {
              normalized.category = categoryResult.category;
              normalized.categoryConfidence = categoryResult.confidence || 0;
              categorizedCount++;
            }

            results.push(normalized);
          } catch (err) {
            console.warn(`[ImportService] Error parsing row ${totalRows}:`, err);
            skippedRows++;
          }
        })
        .on('end', () => {
          console.log(`[ImportService] Parsed ${results.length} transactions, skipped ${skippedRows} rows`);
          resolve({
            transactions: results,
            bank: detectedStrategy.name,
            totalRows,
            skippedRows,
            categorizedCount,
          });
        })
        .on('error', (err) => {
          reject(new Error(`CSV parsing failed: ${err.message}`));
        });
    });
  }

  /**
   * Parse from buffer (for API uploads)
   * Uses streaming by creating a temporary file
   */
  public async detectAndParseBuffer(
    buffer: Buffer,
    hint?: string
  ): Promise<ImportResult> {
    // Write buffer to temp file for streaming
    const os = require('os');
    const path = require('path');
    const tmpPath = os.tmpdir();
    const tmpFile = path.join(tmpPath, `nimbus-import-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`);
    
    try {
      fs.writeFileSync(tmpFile, buffer);
      const result = await this.detectAndParse(tmpFile);
      // Cleanup
      try {
        fs.unlinkSync(tmpFile);
      } catch (cleanupErr) {
        console.warn('[ImportService] Failed to cleanup temp file:', cleanupErr);
      }
      return result;
    } catch (err) {
      // Cleanup on error
      try {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      } catch (cleanupErr) {
        console.warn('[ImportService] Failed to cleanup temp file on error:', cleanupErr);
      }
      throw err;
    }
  }
}

