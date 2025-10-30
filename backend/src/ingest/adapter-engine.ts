import fs from 'fs';
import path from 'path';
import { normalizeGermanNumber } from '../utils/number';
import { normalizeAnyDate } from '../utils/date';

// Local type replicas to avoid cross-package TS imports at build time
type AdapterMatch = {
  anyHeader?: string[];
  allHeaders?: string[];
  filenameIncludes?: string[];
};
type LocaleNumberRule = { col: string; locale?: string };
type ConcatRule = { concat: string[]; sep?: string };
type LookupRule = { from: string; lookup: Record<string, string> };
type CreditDebitRule = { creditCol: string; debitCol: string; locale?: string };
type AnyOfRule = { anyOf: (string | LocaleNumberRule)[] };
type MapValueRule =
  | string
  | LocaleNumberRule
  | ConcatRule
  | LookupRule
  | CreditDebitRule
  | AnyOfRule
  | string[];
type AdapterMap = {
  bookingDate?: MapValueRule;
  valueDate?: MapValueRule;
  amount?: MapValueRule;
  currency?: MapValueRule;
  counterpartName?: MapValueRule;
  counterpartIban?: MapValueRule;
  counterpartBic?: MapValueRule;
  purpose?: MapValueRule;
  txType?: MapValueRule;
  rawCode?: MapValueRule;
};
type Adapter = { id: string; match: AdapterMatch; map: AdapterMap; meta?: any };

export type ChosenAdapter = { id: string } | null;

export function loadAdapters(adapterDir?: string): Adapter[] {
  const baseDir = adapterDir ?? path.resolve(process.cwd(), '../shared/adapters');
  let items: Adapter[] = [];
  if (fs.existsSync(baseDir)) {
    const files = fs.readdirSync(baseDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try {
        const full = path.join(baseDir, f);
        const raw = fs.readFileSync(full, 'utf8');
        const obj = JSON.parse(raw) as Adapter;
        items.push(obj);
      } catch {
        // skip invalid adapter file
      }
    }
  }
  // user adapters
  const userDir = path.resolve(process.cwd(), './data/user-adapters');
  if (fs.existsSync(userDir)) {
    const files = fs.readdirSync(userDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try {
        const full = path.join(userDir, f);
        const raw = fs.readFileSync(full, 'utf8');
        const obj = JSON.parse(raw) as Adapter;
        items.push(obj);
      } catch {
        // skip invalid
      }
    }
  }
  return items;
}

function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function chooseAdapter(headers: string[], adapters?: Adapter[]): ChosenAdapter {
  const list = adapters ?? loadAdapters();
  const set = new Set(headers);
  const normalizedSet = new Set(headers.map(normalizeHeader));
  for (const a of list) {
    const any = a.match.anyHeader ?? [];
    const all = a.match.allHeaders ?? [];
    let ok = true;
    if (any.length) {
      ok = any.some(h => set.has(h) || normalizedSet.has(normalizeHeader(h)));
    }
    if (ok && all.length) {
      ok = all.every(h => set.has(h) || normalizedSet.has(normalizeHeader(h)));
    }
    if (ok) return { id: a.id };
  }
  return null;
}

export type CanonicalRow = {
  bookingDate?: string;
  valueDate?: string;
  amount?: number;
  currency?: string;
  counterpartName?: string;
  counterpartIban?: string;
  counterpartBic?: string;
  purpose?: string;
  txType?: string;
  rawCode?: string;
};

function getCell(row: Record<string, any>, col?: string): any {
  if (!col) return undefined;
  return row[col];
}

function parseLocaleNumber(val: any, locale?: string): number {
  const s = String(val ?? '').trim();
  if (!s) return NaN;
  if (locale === 'de-DE') return normalizeGermanNumber(s);
  return Number(s.replace(/,/g, ''));
}

function resolveRuleValue(rule: MapValueRule, row: Record<string, any>): any {
  if (typeof rule === 'string') return getCell(row, rule);
  if (Array.isArray(rule)) {
    for (const k of rule) {
      const v = getCell(row, k);
      if (v != null && String(v).length) return v;
    }
    return undefined;
  }
  if ((rule as AnyOfRule).anyOf) {
    const any = (rule as AnyOfRule).anyOf;
    for (const r of any) {
      if (typeof r === 'string') {
        const v = getCell(row, r);
        if (v != null && String(v).length) return v;
      } else {
        const v = getCell(row, (r as LocaleNumberRule).col);
        if (v != null && String(v).length) return v;
      }
    }
    return undefined;
  }
  if ((rule as ConcatRule).concat) {
    const { concat, sep } = rule as ConcatRule;
    return concat.map(c => String(getCell(row, c) ?? '')).filter(Boolean).join(sep ?? ' ');
  }
  if ((rule as LookupRule).lookup) {
    const { from, lookup } = rule as LookupRule;
    const key = String(getCell(row, from) ?? '').toUpperCase();
    return lookup[key] ?? undefined;
  }
  if ((rule as CreditDebitRule).creditCol && (rule as CreditDebitRule).debitCol) {
    const { creditCol, debitCol, locale } = rule as CreditDebitRule;
    const cr = parseLocaleNumber(getCell(row, creditCol), locale);
    const dr = parseLocaleNumber(getCell(row, debitCol), locale);
    const credit = Number.isNaN(cr) ? 0 : cr;
    const debit = Number.isNaN(dr) ? 0 : dr;
    return credit - debit;
  }
  if ((rule as LocaleNumberRule).col) {
    const { col, locale } = rule as LocaleNumberRule;
    return getCell(row, col);
  }
  return undefined;
}

export function mapToCanonical(adapter: Adapter, rows: Record<string, any>[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];
  for (const r of rows) {
    const cr: CanonicalRow = {};
    // bookingDate
    const bd = adapter.map.bookingDate ? resolveRuleValue(adapter.map.bookingDate, r) : undefined;
    const vd = adapter.map.valueDate ? resolveRuleValue(adapter.map.valueDate, r) : undefined;
    const amtRaw = adapter.map.amount ? resolveRuleValue(adapter.map.amount, r) : undefined;
    const ccy = adapter.map.currency ? resolveRuleValue(adapter.map.currency, r) : undefined;
    const cpName = adapter.map.counterpartName ? resolveRuleValue(adapter.map.counterpartName, r) : undefined;
    const cpIban = adapter.map.counterpartIban ? resolveRuleValue(adapter.map.counterpartIban, r) : undefined;
    const cpBic = adapter.map.counterpartBic ? resolveRuleValue(adapter.map.counterpartBic, r) : undefined;
    const purpose = adapter.map.purpose ? resolveRuleValue(adapter.map.purpose, r) : undefined;
    const txType = adapter.map.txType ? resolveRuleValue(adapter.map.txType, r) : undefined;
    const rawCode = adapter.map.rawCode ? resolveRuleValue(adapter.map.rawCode, r) : undefined;

    cr.bookingDate = bd ? normalizeAnyDate(String(bd)) : undefined;
    cr.valueDate = vd ? normalizeAnyDate(String(vd)) : undefined;

    if (amtRaw != null) {
      if (typeof adapter.map.amount === 'object' && !Array.isArray(adapter.map.amount)) {
        const rule = adapter.map.amount as any;
        if (rule.creditCol || rule.debitCol) {
          cr.amount = Number(amtRaw);
        } else if (rule.col && rule.locale) {
          cr.amount = parseLocaleNumber(amtRaw, rule.locale);
        } else if (rule.col) {
          cr.amount = parseLocaleNumber(amtRaw, undefined);
        } else {
          cr.amount = Number(amtRaw);
        }
      } else {
        cr.amount = parseLocaleNumber(amtRaw, undefined);
      }
    }

    cr.currency = ccy ? String(ccy) : undefined;
    cr.counterpartName = cpName ? String(cpName) : undefined;
    cr.counterpartIban = cpIban ? String(cpIban) : undefined;
    cr.counterpartBic = cpBic ? String(cpBic) : undefined;
    cr.purpose = purpose ? String(purpose) : undefined;
    cr.txType = txType ? String(txType) : undefined;
    cr.rawCode = rawCode ? String(rawCode) : undefined;

    if (cr.bookingDate && typeof cr.amount === 'number' && !Number.isNaN(cr.amount)) {
      out.push(cr);
    }
  }
  return out;
}


