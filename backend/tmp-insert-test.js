const fs = require('fs');
const path = require('path');
const { insertTransactions, getRecentTransactions, getBalance } = require('./dist/db.js');

async function main() {
  const dynImport = new Function('m', 'return import(m)');
  const mod = await dynImport('@nimbus/parser-de');
  const buf = fs.readFileSync(path.join(__dirname, '..', 'packages', 'parser-de', 'src', 'fixtures', 'generic_de.csv'));
  const res = mod.parseBufferAuto(buf);
  if ('needsMapping' in res) {
    console.log('needsMapping', res.headers);
    return;
  }
  const out = insertTransactions(res.rows);
  console.log('inserted', out);
  console.log('recent', getRecentTransactions(5));
  console.log('balance', getBalance());
}
main().catch(e => { console.error(e); process.exit(1); });


