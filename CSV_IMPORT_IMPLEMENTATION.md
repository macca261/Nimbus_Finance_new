# Universal CSV Importer Implementation

## Overview

Implemented a robust, heuristic-based CSV import service for Nimbus Finanz that automatically detects bank formats, handles encoding issues, and normalizes data into the canonical transactions schema.

## Architecture

### Strategy Pattern

The importer uses a **Strategy Pattern** where each bank has its own strategy class that:
- Detects if it can handle a CSV file (via header matching)
- Maps CSV rows to our canonical `NormalizedTransaction` format
- Specifies CSV parsing options (separator, encoding, skip lines)

### Components

1. **Utilities** (`backend/src/import/utils.ts`)
   - Number parsing (German vs International formats)
   - Date parsing (German DD.MM.YYYY format)
   - Encoding detection (chardet)
   - Synthetic ID generation (MD5 hash for deduplication)

2. **Strategies** (`backend/src/import/strategies/`)
   - `SparkasseStrategy.ts` - Sparkasse bank format
   - `IngStrategy.ts` - ING (DiBa) format
   - `PayPalStrategy.ts` - PayPal exports
   - `DKBStrategy.ts` - Deutsche Kreditbank (2024 format)

3. **Import Service** (`backend/src/services/ImportService.ts`)
   - Auto-detects format by sniffing headers
   - Streams CSV parsing (handles large files)
   - Batch inserts with deduplication
   - Optional PayPal reconciliation scan

4. **API Route** (`backend/src/routes/import.ts`)
   - `POST /api/import/csv` - Upload and import CSV file

## Features

### Automatic Format Detection

The service reads the first 5 lines of a CSV file and matches headers against known bank patterns:

- **Sparkasse**: Contains "Begünstigter/Zahlungspflichtiger" AND "Valutadatum"
- **ING**: Contains "Auftraggeber/Empfänger" AND "Buchungstext"
- **PayPal**: Contains "Transaktionscode" OR "Transaction ID"
- **DKB**: Contains "Zahlungsempfänger*in" (2024 format)

### Encoding Handling

- Uses `chardet` to detect file encoding
- Automatically decodes ISO-8859-1 (Latin1) files that would break with UTF-8
- Falls back to UTF-8 if detection fails

### Number Format Normalization

Handles both German and International formats:

- **German**: "1.234,56" → 123456 cents
- **International**: "1,234.56" → 123456 cents
- Auto-detection based on last punctuation mark
- Handles negative numbers in parentheses: "(1.234,56)" → -123456

### Date Parsing

- German format: "DD.MM.YYYY" or "DD.MM.YY" → "YYYY-MM-DD"
- Handles 2-digit years (assumes 20XX if < 50, 19XX otherwise)
- Falls back to ISO format if already correct

### Deduplication

- Generates synthetic ID: `MD5(date + amount + payee)`
- Uses `INSERT OR IGNORE` with unique index to prevent duplicates
- Skips transactions that already exist

### PayPal Reconciliation (Optional)

When enabled, the service:
- Finds PayPal transactions that haven't been paired
- Looks for matching bank transactions (opposite amount, within 3 days)
- Links them bidirectionally via `pairedTransactionId`

## API Usage

### POST /api/import/csv

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `file`: CSV file
  - `accountId`: Account ID (optional, defaults to 'default')
  - `enableReconciliation`: Boolean (optional, enables PayPal pairing)

**Response:**
```json
{
  "success": true,
  "strategy": "Sparkasse",
  "imported": 150,
  "skipped": 5,
  "pairedTransactions": 3,
  "errors": []
}
```

## Database Schema

The importer inserts into the `transactions` table with these columns:
- `bookingDate` / `valueDate` - Transaction date
- `amountCents` - Amount in cents (negative for expenses)
- `currency` - Currency code (default: EUR)
- `purpose` - Transaction description
- `counterpartName` - Payee name
- `payee` - Payee name (duplicate for compatibility)
- `memo` - Additional memo/description
- `externalId` - Bank's transaction ID or synthetic hash
- `accountId` - Account ID

## Error Handling

- Graceful fallbacks for missing columns
- Skips invalid rows (logs errors but continues)
- Returns detailed error array in response
- Never crashes on encoding/parsing errors

## Performance

- **Streaming**: Uses Node.js streams for memory-efficient parsing
- **Batch Insert**: Groups all inserts into a single transaction
- **Indexed**: Uses existing unique indexes for fast deduplication
- **10MB Limit**: File size limit to prevent DoS

## Testing

To test the importer:

1. **Upload a CSV file:**
```bash
curl -X POST http://localhost:4000/api/import/csv \
  -F "file=@/path/to/sparkasse.csv" \
  -F "accountId=my-account-id" \
  -F "enableReconciliation=true"
```

2. **Check results:**
- Verify transactions appear in database
- Check for duplicates (should be skipped)
- Verify PayPal transactions are paired (if enabled)

## Future Enhancements

- Add more bank strategies (N26, Comdirect, etc.)
- Support for Excel files (.xlsx)
- Progress tracking for large files
- Webhook notifications on completion
- Import history/audit log

