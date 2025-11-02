export type Category =
  | 'income'
  | 'groceries'
  | 'dining'
  | 'transport'
  | 'housing'
  | 'utilities'
  | 'shopping'
  | 'insurance'
  | 'fees'
  | 'transfer'
  | 'other';

const RX = {
  groceries: /(rewe|edeka|aldi|lidl|netto|penny|kaufland)/i,
  dining: /(restaurant|\bbk\b|mcdonald|subway|pizza|cafe|coffee)/i,
  transport: /(db\s*bahn|deutsche\s*bahn|bvg|kvb|mvv|mobility|uber|bolt|flughafen|tankstelle|aral|esso|shell)/i,
  housing: /(miete|kaltmiete|warmmiete|nebenkosten|wohnung)/i,
  utilities: /(strom|gas|wasser|energie|stadtwerke|vodafone|telekom|\bo2\b|1und1|internet)/i,
  insurance: /(versicherung|haftpflicht|krankenversicherung|kfz)/i,
  fees: /(gebühr|entgelt|kartenentgelt|kontoentgelt)/i,
  income: /(gehalt|lohn|salary|überweisung.*(arbeitgeber|employer|payroll)|gutschrift)/i,
  transfer: /(überweisung|transfer|intern|einzahlung|auszahlung)/i,
  shopping: /(amazon|zalando|ikea|mediamarkt|saturn|apotheke)/i,
};

export function categorize(purpose: string, merchant?: string): { category: Category; confidence: number; reason: string } {
  const text = `${purpose || ''} ${merchant || ''}`;
  if (RX.income.test(text)) return { category: 'income', confidence: 0.95, reason: 'income' };
  if (RX.groceries.test(text)) return { category: 'groceries', confidence: 0.95, reason: 'groceries' };
  if (RX.dining.test(text)) return { category: 'dining', confidence: 0.95, reason: 'dining' };
  if (RX.transport.test(text)) return { category: 'transport', confidence: 0.95, reason: 'transport' };
  if (RX.housing.test(text)) return { category: 'housing', confidence: 0.95, reason: 'housing' };
  if (RX.utilities.test(text)) return { category: 'utilities', confidence: 0.95, reason: 'utilities' };
  if (RX.insurance.test(text)) return { category: 'insurance', confidence: 0.95, reason: 'insurance' };
  if (RX.fees.test(text)) return { category: 'fees', confidence: 0.95, reason: 'fees' };
  if (RX.shopping.test(text)) return { category: 'shopping', confidence: 0.95, reason: 'shopping' };
  if (RX.transfer.test(text)) return { category: 'transfer', confidence: 0.5, reason: 'transfer' };
  return { category: 'other', confidence: 0.4, reason: 'other' };
}


