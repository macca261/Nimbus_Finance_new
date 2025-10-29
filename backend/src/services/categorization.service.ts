export type Category =
  | 'Groceries'
  | 'Shopping'
  | 'Dining'
  | 'Transportation'
  | 'Subscriptions'
  | 'Housing'
  | 'Utilities'
  | 'Income'
  | 'Health'
  | 'Entertainment'
  | 'Other';

export type Categorization = {
  category: Category;
  confidence: number; // 0..1
  reason?: string;
};

type Rule = {
  match: (s: string, amount: number) => boolean;
  result: Categorization;
};

const makeKeywordRule = (keywords: string[], category: Category, confidence = 0.9): Rule => ({
  match: (s) => keywords.some(k => s.includes(k.toLowerCase())),
  result: { category, confidence, reason: `Keywords: ${keywords.join(', ')}` },
});

const rules: Rule[] = [
  // Income
  makeKeywordRule(['lohn', 'gehalt', 'salary', 'einkommen'], 'Income', 0.95),
  // Groceries
  makeKeywordRule(['lidl', 'aldi', 'rewe', 'edeka', 'penny', 'kaufland', 'netto'], 'Groceries', 0.95),
  // Shopping
  makeKeywordRule(['amazon', 'zalando', 'ikea', 'mediamarkt', 'saturn'], 'Shopping', 0.9),
  // Subscriptions
  makeKeywordRule(['spotify', 'netflix', 'deezer', 'apple.com/bill', 'microsoft*'], 'Subscriptions', 0.92),
  // Transportation
  makeKeywordRule(['aral', 'shell', 'total', 'esso', 'db fern', 'deutsche bahn', 'bvg', 'hvv', 'mvv'], 'Transportation', 0.9),
  // Dining
  makeKeywordRule(['lieferando', 'mcdonald', 'kfc', 'burger king', 'subway', 'coffee', 'cafe', 'café'], 'Dining', 0.7),
  // Housing / Utilities
  makeKeywordRule(['miete', 'kaltmiete', 'warmmiete'], 'Housing', 0.95),
  makeKeywordRule(['strom', 'gas', 'wasser', 'stadtwerke', 'telekom', 'vodafone', 'o2'], 'Utilities', 0.85),
  // Health
  makeKeywordRule(['apotheke', 'docmorris', 'dm drogerie', 'fitx', 'mcfit'], 'Health', 0.7),
];

export function categorize(text: string, amount: number): Categorization {
  const s = (text || '').toLowerCase();
  if (amount > 0) {
    return { category: 'Income', confidence: 0.6, reason: 'Positive amount heuristic' };
  }
  for (const rule of rules) {
    if (rule.match(s, amount)) return rule.result;
  }
  return { category: 'Other', confidence: 0.3, reason: 'Fallback' };
}


