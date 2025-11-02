const fs = require('fs');
const path = require('path');

async function main(){
  const dynImport = new Function('m','return import(m)');
  const mod = await dynImport('@nimbus/parser-de');
  const buf = fs.readFileSync(path.join(__dirname, 'packages','parser-de','src','fixtures','commerzbank_sample.csv'));
  const res = mod.parseBufferAuto(buf);
  console.log('adapterId', 'needsMapping' in res ? 'needsMapping' : res.adapterId);
}
main();


