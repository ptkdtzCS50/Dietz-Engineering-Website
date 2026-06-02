const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = __dirname;
const source = fs.readFileSync(path.join(root, 'src', 'index.njk'), 'utf8');
const assetPath = path.join(root, 'src', 'static', 'images', 'showcase', 'eplan-design-upright-v2.jpg');

assert(
  source.includes('images/showcase/eplan-design-upright-v2.jpg'),
  'EPLAN showcase card must reference the cache-busted upright image asset'
);
assert(
  !source.includes('<img src="images/showcase/eplan-design.jpg" alt="Engineering-Arbeitsplatz mit EPLAN-Schaltplan auf zwei Monitoren"'),
  'EPLAN showcase card must not keep using the old cached image URL'
);
assert(fs.existsSync(assetPath), 'cache-busted upright EPLAN image asset exists');
assert(fs.statSync(assetPath).size > 100000, 'upright EPLAN image asset is a real photo, not an empty placeholder');

console.log('OK eplan showcase image uses cache-busted upright asset');
