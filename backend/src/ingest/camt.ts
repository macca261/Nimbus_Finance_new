import { XMLParser } from 'fast-xml-parser';
import { normalizeAnyDate } from '../utils/date';
import { normalizeGermanNumber } from '../utils/number';

export type CamtCanonical = {
  bookingDate: string;
  amount: number;
  currency?: string;
  endToEndId?: string;
  mandateRef?: string;
  creditorId?: string;
  purpose?: string;
};

export function parseCamt053(xml: string): { bankName?: string; rows: CamtCanonical[] } {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const obj = parser.parse(xml);
  // CAMT.053 structure: Document -> BkToCstmrStmt -> Stmt[] -> Ntry[]
  const doc = obj?.Document?.BkToCstmrStmt ?? obj?.Document?.BkToCstmrAcctRpt;
  const stmts = Array.isArray(doc?.Stmt) ? doc.Stmt : doc?.Stmt ? [doc.Stmt] : [];
  const rows: CamtCanonical[] = [];
  for (const stmt of stmts) {
    const ntries = Array.isArray(stmt.Ntry) ? stmt.Ntry : stmt.Ntry ? [stmt.Ntry] : [];
    for (const n of ntries) {
      const bkDate = n.BookgDt?.Dt ?? n.BookgDt?.DtTm ?? n.ValDt?.Dt ?? n.ValDt?.DtTm;
      const amtNode = n.Amt;
      const amt = typeof amtNode === 'object' ? Number(amtNode['#text'] ?? amtNode.text ?? amtNode.value) : Number(amtNode);
      const ccy = typeof amtNode === 'object' ? (amtNode.ccy || amtNode.Ccy) : undefined;
      const dt = normalizeAnyDate(String(bkDate));

      let endToEndId: string | undefined;
      let mandateRef: string | undefined;
      let creditorId: string | undefined;
      let purpose: string | undefined;

      const txDtls = n.NtryDtls?.TxDtls ?? n.NtryDtls?.BkTxCd;
      const txList = Array.isArray(txDtls) ? txDtls : txDtls ? [txDtls] : [];
      for (const t of txList) {
        const refs = t?.Refs ?? t?.RltdPties ?? {};
        if (!endToEndId && refs?.EndToEndId) endToEndId = refs.EndToEndId;
        if (!mandateRef && refs?.MndtId) mandateRef = refs.MndtId;
        if (!creditorId && refs?.CdtrSchmeId?.Id?.PrvtId?.Othr?.Id) creditorId = refs.CdtrSchmeId.Id.PrvtId.Othr.Id;
        if (!purpose && t?.RmtInf?.Ustrd) {
          const rem = t.RmtInf.Ustrd;
          purpose = Array.isArray(rem) ? rem.join(' ') : String(rem);
        }
      }

      if (dt && !Number.isNaN(amt)) {
        rows.push({ bookingDate: dt, amount: amt, currency: ccy, endToEndId, mandateRef, creditorId, purpose });
      }
    }
  }

  return { bankName: obj?.Document?.BkToCstmrStmt?.Stmt?.Acct?.Svcr?.FinInstnId?.Nm, rows };
}


