import { db } from '../../src/db';
import crypto from 'node:crypto';

function fp(d: string, cents: number, p: string) {
  return crypto.createHash('sha256').update(`${d}|${cents}|${p}`).digest('hex');
}

const ins = db.prepare(`INSERT OR IGNORE INTO transactions (bookingDate, amountCents, currency, purpose, category, fingerprint) VALUES (?,?,?,?,?,?)`);

const now = new Date();
const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
const prev = new Date(now.getFullYear(), now.getMonth()-1, 1);
const ymp = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;

const rows: Array<[string, number, string, string | null]> = [
  [`${ym}-01`, 320000, 'GEHALT ACME GMBH', 'income'],
  [`${ym}-02`, -3124, 'REWE MARKT 123', 'groceries'],
  [`${ym}-03`, -990, 'KARTENENTGELT', 'fees'],
  [`${ym}-04`, -45000, 'MIETE', 'housing'],
  [`${ym}-05`, -1299, 'NETFLIX', 'subscriptions'],
  [`${ym}-06`, 12345, 'ERSTATTUNG SHOP', 'income'],
  [`${ymp}-10`, -2599, 'ALDI SÜD', 'groceries'],
  [`${ymp}-11`, -5600, 'DEUTSCHE BAHN', 'transport'],
];

for (const [d, c, p, cat] of rows) {
  ins.run(d, c, 'EUR', p, cat, fp(d, c, p));
}

console.log('Seeded', rows.length, 'transactions');


