// Prints what the scanner pulls out of each pasted article in tests/articles.
// Run: node tests/run.js
const fs = require('fs');
const path = require('path');
const { parseRecipe } = require('../parser.js');
const dir = path.join(__dirname, 'articles');
for (const f of fs.readdirSync(dir).sort()) {
  const r = parseRecipe(fs.readFileSync(path.join(dir, f), 'utf8'));
  console.log(`\n===== ${f}\nNAME: ${r.name}\nDESCRIPTION:\n${r.description}\nINGREDIENTS:`);
  r.ingredients.forEach((n) => console.log(`  - ${n}${r.amounts[n.toLowerCase()] ? `   [${r.amounts[n.toLowerCase()]}]` : ''}`));
  console.log(`DIRECTIONS:\n${r.directions}`);
}
