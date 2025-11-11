// Category patterns - bundled for browser compatibility
import type { Category } from '../types.js';

export interface PatternRule {
  category: Category;
  pattern: RegExp;
  reason: string;
}

export const patterns: PatternRule[] = [
  { category: 'Income', pattern: /(gehalt|lohn|besoldung|rentenzahlung|steuerrückzahlung|dividende)/i, reason: 'income pattern' },
  { category: 'Groceries', pattern: /(supermarkt|lebensmittel|einkauf.*lebensmittel|bäckerei|metzgerei|obst|gemüse)/i, reason: 'groceries pattern' },
  { category: 'Dining', pattern: /(restaurant|café|cafe|bäckerei.*frühstück|imbiss|fast.?food|pizzeria|döner|kebab)/i, reason: 'dining pattern' },
  { category: 'Transport', pattern: /(tankstelle|benzin|diesel|kraftstoff|ticket|fahrkarte|bahn|zug|bus|ubahn|sbahn|taxi|mietwagen)/i, reason: 'transport pattern' },
  { category: 'Housing', pattern: /(miete|mietzins|hausgeld|nebenkosten|hausverwaltung|immobilien|wohngeld)/i, reason: 'housing pattern' },
  { category: 'Utilities', pattern: /(strom|gas|wasser|heizung|telefon|internet|mobilfunk|vertrag|gebühr.*telekom)/i, reason: 'utilities pattern' },
  { category: 'Health', pattern: /(apotheke|arzt|zahnarzt|krankenhaus|krankenversicherung|medikament|rezept)/i, reason: 'health pattern' },
  { category: 'Subscriptions', pattern: /(abo|subscription|mitgliedschaft|beitrag.*verein|spenden)/i, reason: 'subscriptions pattern' },
  { category: 'Shopping', pattern: /(online.*shop|versand|bestellung|waren|kauf|einkauf)/i, reason: 'shopping pattern' },
  { category: 'Education', pattern: /(schule|universität|studium|seminar|kurs|bildung|bücher|buchhandlung)/i, reason: 'education pattern' },
  { category: 'Entertainment', pattern: /(kino|theater|konzert|musik|spiel|spiele|event|veranstaltung)/i, reason: 'entertainment pattern' },
  { category: 'Fees', pattern: /(gebühr|entgelt|bearbeitungsgebühr|kartengebühr|kontoführungsgebühr|spesen)/i, reason: 'fees pattern' },
  { category: 'Insurance', pattern: /(versicherung|prämie|beitrag.*versicherung|krankenversicherung|haftpflicht|kasko)/i, reason: 'insurance pattern' },
  { category: 'Taxes', pattern: /(steuer|finanzamt|steuerberater|steuerbescheid|vorauszahlung)/i, reason: 'taxes pattern' },
  { category: 'Travel', pattern: /(hotel|reise|flug|flughafen|reisebüro|urlaub|ferien|booking|airbnb)/i, reason: 'travel pattern' },
  { category: 'Gifts', pattern: /(geschenk|spende|spenden|spendenaktion)/i, reason: 'gifts pattern' },
  { category: 'Savings', pattern: /(sparen|sparbuch|depot|anlage|investment|fonds|sparplan)/i, reason: 'savings pattern' },
  { category: 'Transfers', pattern: /(überweisung|dauerauftrag|lastschrift|transfer|gutschrift|auftrag)/i, reason: 'transfers pattern' },
];

