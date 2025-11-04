# @nimbus/parsers-de

German bank CSV parser package for Nimbus Finance.

## Supported Banks

- Deutsche Bank
- Commerzbank
- ING
- Postbank

## Usage

```typescript
import { parseTransactions } from '@nimbus/parsers-de';

const buffer = fs.readFileSync('bank-statement.csv');
const transactions = parseTransactions(buffer);
// or with explicit bank hint:
const transactions = parseTransactions(buffer, 'ing');
```

## Features

- Auto-detects bank format from CSV headers
- Handles CP1252/Win-1252 encoding (falls back from UTF-8)
- Normalizes German date format (dd.MM.yyyy → yyyy-MM-dd)
- Normalizes German amount format (1.234,56 → 1234.56)
- Supports semicolon and comma delimiters

