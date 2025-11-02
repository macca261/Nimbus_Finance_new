const fs = require('fs');
const path = require('path');

async function main() {
  const dynImport = new Function('m', 'return import(m)');
  const mod = await dynImport('@nimbus/parser-de');
  const buf = fs.readFileSync(path.join(__dirname, '..', 'packages', 'parser-de', 'src', 'fixtures', 'generic_de.csv'));
  const res = mod.parseBufferAuto(buf);
  console.log('ok', 'needsMapping' in res ? res : { adapterId: res.adapterId, rows: res.rows.length });
}
main().catch((e) => { console.error('err', e); process.exit(1); });


