# Universal CSV Importer - Unicorn-Grade Enhancements

## Overview

Enhanced the CSV import pipeline with advanced features to handle real-world German banking chaos: encoding traps, header drift, and garbage preambles.

## Key Enhancements

### 1. The "Sniffer" Pattern

#### Encoding Detection (1KB Sample)
- Reads first 1KB of file for efficient encoding detection
- Uses `chardet` to detect UTF-8 vs ISO-8859-1 (Latin-1)
- Handles Müller, Überweisung, and other German characters correctly

#### Header Hunter Algorithm
- Scans first 20 lines (not just 5) to find header row
- Handles "garbage preamble" (ING's 10 lines of account info)
- Returns both strategy and header row index
- Automatically calculates `skipLines` based on detected header position

### 2. New Bank Strategies

#### N26 Strategy
- **Headers**: `Verwendungszweck` AND `Betrag (EUR)`
- **Delimiter**: Comma `,`
- **Encoding**: UTF-8
- **Auto-detects** number format (German vs International)

#### Commerzbank Strategy
- **Headers**: `Umsatzart` AND `IBAN Auftraggeberkonto`
- **Delimiter**: Semicolon `;`
- **Encoding**: UTF-8
- **Number format**: German (1.234,56)

#### DKB Old Format Strategy
- **Headers**: `Mandatsreferenz` AND `Gläubiger-ID`
- **Delimiter**: Semicolon `;`
- **Encoding**: ISO-8859-1 (Latin-1)
- **Handles** pre-2024 DKB exports

### 3. Payee Cleaning Pipeline

All strategies now use the `cleanPayee()` function to produce clean merchant names:

**Before:**
- `PAYPAL *SPOTIFY S.A.R.L. 823409234`
- `SumUp *REWE`
- `AMZN Mktp *Amazon`
- `Netflix GmbH`

**After:**
- `Spotify`
- `REWE`
- `Amazon`
- `Netflix`

**Cleaning Rules:**
1. Removes PSP prefixes: `PAYPAL *`, `SumUp *`, `AMZN Mktp *`
2. Removes legal entities: `GmbH`, `Co. KG`, `S.a.r.l.`, `Limited`, `AG`, `UG`, `e.V.`
3. Removes trailing transaction IDs (6+ digits)
4. Normalizes whitespace

### 4. Instant Reconciliation Detection

After import, automatically detects potential "double counts" (internal transfers):

```sql
SELECT COUNT(DISTINCT t1.id) as count
FROM transactions t1
JOIN transactions t2 ON ABS(t1.amountCents) = ABS(t2.amountCents)
WHERE t1.bookingDate = t2.bookingDate
  AND t1.id != t2.id
  AND (t1.source != t2.source OR t1.sourceProfile != t2.sourceProfile)
  AND t1.isInternalTransfer = 0
  AND t2.isInternalTransfer = 0
```

Returns count in `potentialInternalTransfers` field for frontend badge display.

## Updated Bank Fingerprints

| Bank | Encoding | Delimiter | Unique Header Signature |
|------|----------|-----------|------------------------|
| Sparkasse | ISO-8859-1 | `;` | `Begünstigter/Zahlungspflichtiger` AND `Valutadatum` |
| ING (DiBa) | ISO-8859-1 | `;` | `Auftraggeber/Empfänger` AND `Buchungstext` |
| DKB (New 2024) | UTF-8 | `;` | `Zahlungsempfänger*in` AND `Zahlungspflichtige*r` |
| DKB (Old) | ISO-8859-1 | `;` | `Mandatsreferenz` AND `Gläubiger-ID` |
| N26 | UTF-8 | `,` | `Verwendungszweck` AND `Betrag (EUR)` |
| PayPal (DE) | UTF-8 | `,` | `Transaktionscode` AND `Brutto` |
| Commerzbank | UTF-8 | `;` | `Umsatzart` AND `IBAN Auftraggeberkonto` |

## API Response Enhancement

The import endpoint now returns:

```json
{
  "success": true,
  "strategy": "Sparkasse",
  "imported": 150,
  "skipped": 5,
  "pairedTransactions": 3,
  "potentialInternalTransfers": 2,
  "errors": []
}
```

## Architecture Improvements

### Strategy Detection Order
Strategies are checked in order of specificity:
1. DKB Old Format (most specific)
2. DKB New Format (2024)
3. Sparkasse
4. ING
5. PayPal
6. N26
7. Commerzbank

### Header Row Detection
- Scans up to 20 lines (handles ING's 10-line preamble)
- Uses encoding-aware line reading
- Returns exact header row index for accurate `skipLines` calculation

### Encoding Handling
- Detects encoding from first 1KB (efficient)
- Falls back gracefully if detection fails
- Uses `iconv-lite` for on-the-fly decoding in streams

## Performance

- **Encoding Detection**: 1KB sample (fast)
- **Header Hunting**: Up to 20 lines (handles worst case)
- **Streaming**: Memory-efficient for large files
- **Batch Insert**: Single transaction for all rows
- **Deduplication**: MD5 hash-based (deterministic)

## Testing Recommendations

1. **Encoding Test**: Import Sparkasse CSV with "Müller" in payee
2. **Header Drift Test**: Import both old and new DKB formats
3. **Garbage Preamble Test**: Import ING CSV with account info at top
4. **Payee Cleaning Test**: Import PayPal transaction with "PAYPAL *MERCHANT GmbH"
5. **Reconciliation Test**: Import both PayPal and Bank CSV for same period

## Future Enhancements

- [ ] Excel file support (.xlsx)
- [ ] Progress tracking for large files
- [ ] Webhook notifications on completion
- [ ] Import history/audit log
- [ ] Automatic internal transfer flagging (not just detection)

