import fs from 'fs';
import path from 'path';
import { prisma } from '../db/prisma';

type Category =
  | 'Groceries'
  | 'Transportation'
  | 'Fees'
  | 'Income'
  | 'Shopping'
  | 'Dining'
  | 'Subscriptions'
  | 'Housing'
  | 'Utilities'
  | 'Health'
  | 'Entertainment'
  | 'Other';

export type Categorization = { category: Category; confidence: number; method: 'rule' | 'ml' | 'ai'; reason?: string; model?: string; hits?: string[]; patterns?: string[] };

type UserRule = { pattern: string; category: Category };

const USER_RULES_FILE = path.resolve(process.cwd(), './data/user-rules.json');
const RULE_PACK_FILE = path.resolve(process.cwd(), '../shared/rules/de_rules.v1.json');

function loadUserRules(): UserRule[] {
  try {
    if (!fs.existsSync(USER_RULES_FILE)) return [];
    const raw = fs.readFileSync(USER_RULES_FILE, 'utf8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr as UserRule[];
    return [];
  } catch {
    return [];
  }
}

export function saveUserRule(rule: UserRule) {
  const rules = loadUserRules();
  rules.push(rule);
  fs.mkdirSync(path.dirname(USER_RULES_FILE), { recursive: true });
  fs.writeFileSync(USER_RULES_FILE, JSON.stringify(rules, null, 2), 'utf8');
}

export function categorizeText(text: string, amount: number): Categorization {
  const s = (text || '').toUpperCase();
  // User rules first
  for (const r of loadUserRules()) {
    if (s.includes(r.pattern.toUpperCase())) {
      return { category: r.category, confidence: 0.99, method: 'rule', reason: `User rule matched: ${r.pattern}`, model: 'rules:v1', hits: [r.pattern], patterns: [r.pattern] };
    }
  }
  // Rule pack
  try {
    const raw = fs.readFileSync(RULE_PACK_FILE, 'utf8');
    const pack: { code: string; testRegex: string; why: string }[] = JSON.parse(raw);
    const hits: string[] = [];
    const patterns: string[] = [];
    for (const r of pack) {
      const re = new RegExp(r.testRegex, 'i');
      if (re.test(s)) { hits.push(r.code); patterns.push(r.testRegex); }
    }
    if (hits.length) {
      // Simple mapping from codes to categories
      const category = hits.some(h => h.startsWith('groceries.')) ? 'Groceries'
        : hits.some(h => h.startsWith('transport.')) ? 'Transportation'
        : hits.some(h => h.startsWith('fees.')) ? 'Fees'
        : hits.some(h => h.startsWith('subs.')) ? 'Subscriptions'
        : hits.some(h => h.startsWith('fuel.')) ? 'Utilities'
        : hits.some(h => h.startsWith('shopping.')) ? 'Shopping'
        : hits.some(h => h.startsWith('dining.')) ? 'Dining'
        : 'Other';
      return { category, confidence: 0.96, method: 'rule', model: 'rules:v1', reason: 'Matched rule pack', hits, patterns };
    }
  } catch { /* ignore */ }

  // Heuristics
  if (amount > 0) return { category: 'Income', confidence: 0.9, method: 'rule', reason: 'Positive amount heuristic' };
  if (/(REWE|ALDI|LIDL|EDEKA|PENNY|KAUFLAND|NETTO)/.test(s)) return { category: 'Groceries', confidence: 0.97, method: 'rule', reason: 'Matched grocery pattern', model: 'rules:v1', hits: ['groceries.heuristic'], patterns: ['/(REWE|ALDI|LIDL|EDEKA|PENNY|KAUFLAND|NETTO)/'] };
  if (/(BAHN|KVB|BVG|HVV|MVV|UBER|BOLT|TAXI)/.test(s)) return { category: 'Transportation', confidence: 0.95, method: 'rule', reason: 'Matched transportation pattern', model: 'rules:v1', hits: ['transport.heuristic'], patterns: ['/(BAHN|KVB|BVG|HVV|MVV|UBER|BOLT|TAXI)/'] };
  if (/(GEBUEHR|GEBÜHR|FEE|ENTGELT|KARTENGEBUEHR)/.test(s)) return { category: 'Fees', confidence: 0.96, method: 'rule', reason: 'Matched fee pattern', model: 'rules:v1', hits: ['fees.heuristic'], patterns: ['/(GEBUEHR|GEBÜHR|FEE|ENTGELT|KARTENGEBUEHR)/'] };
  // ML stub (future ONNX)
  // return { category: 'Other', confidence: 0.7, method: 'ml', model: 'onnx-stub', reason: 'Stub classifier' };
  return { category: 'Other', confidence: 0.4, method: 'ai', model: 'ai:gpt', reason: 'Fallback (no rule matched)' };
}

export async function categorizeNewTransactions(limit = 500): Promise<{ updated: number }> {
  const txs = await prisma.transaction.findMany({
    where: {
      OR: [
        { categoryId: null },
        { categoryConfidence: null },
        { categoryConfidence: { lt: 0.7 } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  let updated = 0;
  for (const t of txs) {
    const text = [t.counterpartName, t.purpose].filter(Boolean).join(' ');
    const c = categorizeText(text, Number(t.amount));
    await prisma.transaction.update({ where: { id: t.id }, data: { categoryId: c.category, categoryConfidence: c.confidence } });
    updated++;
  }
  return { updated };
}


