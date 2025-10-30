export class CategorizationService {
  private rules = [
    { test: (tx: any) => /REWE|ALDI|LIDL|EDEKA|NETTO/i.test(tx.purpose ?? ''), category: 'Groceries', why: 'Matched grocery chain', confidence: 0.95 },
    { test: (tx: any) => /UBER|BOLT|TAXI|BAHN|KVB/i.test(tx.purpose ?? ''), category: 'Transportation', why: 'Matched transportation service', confidence: 0.90 },
    { test: (tx: any) => /AMAZON|EBAY|ZOOTALO|MEDIAMARKT/i.test(tx.purpose ?? ''), category: 'Shopping', why: 'Matched online retailer', confidence: 0.92 },
    { test: (tx: any) => /SPOTIFY|NETFLIX|DISNEY|YOUTUBE/i.test(tx.purpose ?? ''), category: 'Subscriptions', why: 'Matched subscription service', confidence: 0.98 },
    { test: (tx: any) => /ARAL|SHELL|TANK|ESSO/i.test(tx.purpose ?? ''), category: 'Fuel', why: 'Matched fuel station', confidence: 0.94 },
    { test: (tx: any) => tx.amount > 0, category: 'Income', why: 'Positive amount detected', confidence: 0.85 },
  ];

  async categorizeTransaction(transaction: any): Promise<{ category: string; confidence: number; method: 'rule' | 'ai' | 'ml'; model?: string; reason?: string; }> {
    for (const rule of this.rules) {
      if (rule.test(transaction)) {
        return { category: rule.category, confidence: rule.confidence, method: 'rule', reason: rule.why };
      }
    }
    return { category: 'Other', confidence: 0.5, method: 'ai', model: 'gpt-4', reason: 'No rules matched, used AI fallback' };
  }
}


