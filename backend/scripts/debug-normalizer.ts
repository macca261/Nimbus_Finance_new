import { normalize } from '../src/normalizer/engine';

const [, , rawText, rawCounterparty] = process.argv;

if (!rawText) {
  console.error('Usage: ts-node scripts/debug-normalizer.ts "<text>" [counterparty]');
  process.exit(1);
}

const result = normalize({
  text: rawText,
  counterparty: rawCounterparty,
});

// eslint-disable-next-line no-console
console.log(JSON.stringify(result, null, 2));


