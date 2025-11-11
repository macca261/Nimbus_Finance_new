const fs = require('fs');
const { tryDecodeBuffer, normalizeHeader } = require('../dist/parser/utils');

const buffer = fs.readFileSync('../tests/fixtures/paypal_min.csv');
const text = tryDecodeBuffer(buffer).text;

const MISENCODED_PATTERN = /[ÃÂ]|ï»¿/;

const ensureUtf8 = (value) => {
  if (!MISENCODED_PATTERN.test(value)) {
    return value;
  }
  return Buffer.from(value, 'latin1').toString('utf8');
};

const sanitize = (input) =>
  input
    .replace(/\uFEFF/g, '')
    .split(/\r\n|\r|\n/)
    .map(line => {
      const recoded = ensureUtf8(line).replace(/\uFEFF/g, '');
      const trimmed = recoded.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1);
      }
      return recoded;
    })
    .join('\n');

const sanitizedLines = sanitize(text).split('\n');

const detectDelimiter = (line) => (ensureUtf8(line).includes('";"') ? ';' : ',');

const splitRow = (line, delimiter) => {
  const normalized = ensureUtf8(line).replace(/\uFEFF/g, '').trim();
  if (!normalized) return [];
  const inner = normalized.startsWith('"') && normalized.endsWith('"') ? normalized.slice(1, -1) : normalized;
  const demasked = inner.replace(/""/g, '"');
  const separator = delimiter === ',' ? '","' : '";"';
  return demasked.split(separator).map(value => {
    let result = ensureUtf8(value).replace(/\uFEFF/g, '');
    while (result.startsWith('"') && result.endsWith('"') && result.length >= 2) {
      result = result.slice(1, -1);
    }
    return result;
  });
};

const delimiter = detectDelimiter(sanitizedLines[0]);
const headers = splitRow(sanitizedLines[0], delimiter);

const records = sanitizedLines.slice(1).map(line => {
  const fields = splitRow(line, delimiter);
  const record = {};
  headers.forEach((header, idx) => {
    record[header] = fields[idx] ?? '';
  });
  return record;
});

console.log('headers', headers);
console.log('records', records.length);
records.slice(0, 4).forEach((record, idx) => {
  console.log(idx, record);
});

