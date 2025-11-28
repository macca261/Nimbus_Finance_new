CSV module scaffolding:
- `types.ts`: Bank signatures, raw-file context, parse result/warnings.
- `parserTypes.ts`: Parser context + `BankParser` interface.
- `bankSignatures.ts`: TODO list for Sparkasse, Volksbank/Postbank, N26, Revolut, Bunq, PayPal, brokerage signatures.
- `detectBank.ts`: header-based scoring to pick a signature.
- `parseBankCsv.ts`: orchestrator placeholder (`ingestFile`, `PARSERS` still stubbed).


