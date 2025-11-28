import type { ParseResult } from './types';
import type { CanonicalTransaction } from '@nimbus/shared/src/types/canonical';
import { detectBank } from './detectBank';
import { ingestFile } from './ingestFile';
import { PARSERS } from './parsers';

export async function parseBankCsv(buffer: Buffer, filename?: string): Promise<ParseResult> {
  const raw = await ingestFile(buffer, filename);
  const detection = detectBank(raw.header);

  if (!detection.signature) {
    return {
      bankSignature: null,
      transactions: [],
      warnings: [{ rowIndex: -1, message: 'Unknown CSV layout – no bank signature matched' }],
      detection,
      header: raw.header,
    };
  }

  const parser = PARSERS.find(p => p.canHandle(detection.signature));
  if (!parser) {
    return {
      bankSignature: detection.signature,
      transactions: [],
      warnings: [
        {
          rowIndex: -1,
          message: `No parser implemented for signature ${detection.signature.id}`,
        },
      ],
      detection,
      header: raw.header,
    };
  }

  const transactions: CanonicalTransaction[] = parser.parse({
    signature: detection.signature,
    header: raw.header,
    rows: raw.rows,
  });

  return {
    bankSignature: detection.signature,
    transactions,
    warnings: [],
    detection,
    header: raw.header,
  };
}


