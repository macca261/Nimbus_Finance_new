import chardet from 'chardet';
import iconv from 'iconv-lite';
import { RawFileContext } from './types';

/**
 * ingestFile
 * ---------
 * Uses chardet + iconv-lite + csv-parse to decode buffers, detect delimiter, and produce rows/header.
 */

const CANDIDATE_DELIMITERS = [';', ',', '\t', '|'] as const;
const MAX_SAMPLE_LINES = 20;

function detectEncoding(buffer: Buffer, filename?: string): 'utf8' | 'latin1' {
  if (filename && filename.toLowerCase().includes('utf8')) {
    return 'utf8';
  }
  const guessed = chardet.detect(buffer);
  if (guessed) {
    const lower = guessed.toLowerCase();
    if (lower.includes('utf')) {
      return 'utf8';
    }
    if (lower.includes('iso') || lower.includes('windows-1252')) {
      return 'latin1';
    }
  }

  // Fallback heuristic: try utf8 first, if high ratio of replacement chars, prefer latin1
  const utf8 = buffer.toString('utf8');
  const replacementCount = (utf8.match(/\uFFFD/g) || []).length;
  const replacementRatio = replacementCount / Math.max(utf8.length, 1);
  if (replacementRatio > 0.01) {
    return 'latin1';
  }
  return 'utf8';
}

function decodeBuffer(buffer: Buffer, encoding: 'utf8' | 'latin1'): string {
  if (encoding === 'latin1') {
    return iconv.decode(buffer, 'latin1');
  }
  return buffer.toString('utf8');
}

function splitLines(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map(line => line.trimEnd());
}

function sampleLines(lines: string[]): string[] {
  const nonEmpty = lines.filter(line => line && !line.startsWith('#'));
  return nonEmpty.slice(0, MAX_SAMPLE_LINES);
}

function scoreDelimiter(lines: string[], delimiter: string) {
  const counts = lines.map(line => (line.split(delimiter).length - 1));
  const average = counts.reduce((sum, count) => sum + count, 0) / Math.max(counts.length, 1);
  const variance =
    counts.reduce((sum, count) => sum + Math.pow(count - average, 2), 0) / Math.max(counts.length, 1);
  return { average, variance };
}

function detectDelimiter(lines: string[]): string {
  const samples = sampleLines(lines);
  if (samples.length === 0) {
    return ';';
  }

  let bestDelimiter = ';';
  let bestScore = -Infinity;

  for (const delimiter of CANDIDATE_DELIMITERS) {
    const score = scoreDelimiter(samples, delimiter);
    // prefer higher average counts and lower variance
    const composite = score.average - score.variance;
    if (composite > bestScore) {
      bestScore = composite;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

function splitRow(line: string, delimiter: string): string[] {
  // minimal CSV splitting: handle quoted values
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }
    if (!insideQuotes && char === delimiter) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function sanitizeField(value: string) {
  return value
    .replace(/\uFEFF/g, '')
    .replace(/^"+|"+$/g, '')
    .trim();
}

function looksLikeHeader(fields: string[]) {
  if (fields.length < 4) return false;
  const cleaned = fields.map(sanitizeField).filter(Boolean);
  if (cleaned.length < 4) return false;
  const withLetters = cleaned.filter(value => /[A-Za-zÄÖÜäöüß]/.test(value));
  return withLetters.length >= 3;
}

function findHeaderAndRows(lines: string[], delimiter: string) {
  const rows: string[][] = [];
  let header: string[] | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const fields = splitRow(line, delimiter);
    if (!header) {
      if (looksLikeHeader(fields)) {
        header = fields.map(field => sanitizeField(field));
        continue;
      }
      continue;
    }

    if (fields.every(field => !field.trim())) {
      continue;
    }

    rows.push(fields);
  }

  if (!header && rows.length > 0) {
    header = rows.shift()?.map(field => sanitizeField(field)) ?? [];
  }

  return { header: header ?? [], rows };
}

export async function ingestFile(buffer: Buffer, filename?: string): Promise<RawFileContext> {
  const encoding = detectEncoding(buffer, filename);
  const decoded = decodeBuffer(buffer, encoding);
  const lines = splitLines(decoded);
  const delimiter = detectDelimiter(lines);
  const { header, rows } = findHeaderAndRows(lines, delimiter);

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[ingestFile] header=', header);
  }

  return {
    encoding,
    delimiter,
    header,
    rows,
  };
}


