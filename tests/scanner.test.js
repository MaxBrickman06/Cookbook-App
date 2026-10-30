// Photo import: what the app does with the text the OCR engine reads. Run: node --test
// The .txt files in tests/ocr/ are the engine's raw output on the photos in demo/ (recorded in the browser).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cleanOcrText, parseScannedText } = require('../scanner.js');

const scan = (file) => parseScannedText((fs.readFileSync(path.join(__dirname, 'ocr', file), 'utf8')));
const steps = (r) => r.directions.split('\n').filter((l) => /^\d+\. /.test(l));

test('photo: a screenshot of a video description (dark mode, app buttons around it)', () => {
  const r = scan('video-description-screenshot.txt');
  assert.equal(r.name, 'Cheesy Garlic Potato Bites Fried');
  assert.deepEqual(r.ingredients, ['Potatoes', 'Butter', 'Parmesan', 'Salt', 'Garlic powder', 'Parsley', 'Cornstarch', 'Egg', 'Mozzarella', 'Oil']);
  assert.equal(r.amounts.egg, '1');              // OCR read "1egg"
  assert.equal(r.amounts.parsley, '1 tsp');      // "1tsp parsley"
  assert.equal(steps(r).length, 5);
  assert.doesNotMatch(r.description + r.directions, /Likes|Views|Description/);
});

test('photo: a curved, shadowed cookbook page — misread "|bs", lower-case title, an unreadable fraction', () => {
  const r = scan('cookbook-page.txt');
  assert.equal(r.name, 'Cajun-Roasted Potatoes');
  assert.equal(r.ingredients.length, 6);
  assert.deepEqual([r.ingredients[0], ...r.ingredients.slice(2)], ['Potatoes', 'Garlic', 'Salt', 'Black pepper', 'Cayenne pepper']);
  assert.equal(r.amounts.potatoes, '2 lbs, baby');
  assert.equal(r.amounts.garlic, '2 cloves, minced');
  assert.equal(r.amounts['cayenne pepper'], '? t');           // "½ t" read as "% t": shown as "?" to check, not guessed
  assert.match(steps(r)[0], /^1\. Set Bravo to .Roast. and preheat at 450°F/);
});

test('OCR clean-up', () => {
  const lines = cleanOcrText('Ingrediants:\n2 |bs baby potatoes\nv4 ¢ olive oll\n% t cayenne pepper\n1egg\nTegg\n— Sea salt, as needed \\\npe ee -— cu\n\n\n\npirections:\n1, Set the oven.\n2; Ina bowl, toss.\nShow more\nQil for frying\n1/4 tsp salt').split('\n');
  assert.deepEqual(lines, ['Ingredients:', '2 lbs baby potatoes', '? c olive oil', '? t cayenne pepper', '1 egg', '1 egg', 'Sea salt, as needed', '',
    'Directions:', '1. Set the oven.', '2. Ina bowl, toss.', 'Oil for frying', '1/4 tsp salt']);
});
