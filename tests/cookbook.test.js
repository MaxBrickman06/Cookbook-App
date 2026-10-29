// Checks named in the requirements spec (docs/requirements, "Verified by" column).
// Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const C = require('../cookbook.js');
const { parseRecipe } = require('../parser.js');
const { importFromUrl } = require('../importer.js');

/* FR-1 */
test('recipe_requires_name', () => {
  // A normal name is kept (trimmed).
  assert.deepEqual(C.checkRecipeName({ name: '  Pancakes ', description: '' }), { status: 'ok', name: 'Pancakes' });

  // 1 and 100 characters are fine; 101 is not.
  assert.equal(C.checkRecipeName({ name: 'x' }).status, 'ok');
  assert.equal(C.checkRecipeName({ name: 'x'.repeat(100) }).status, 'ok');
  assert.equal(C.checkRecipeName({ name: 'x'.repeat(101) }).status, 'too-long');

  // Empty name + description → warn and fill the name with the description's first line (not saved yet).
  const filled = C.checkRecipeName({ name: '   ', description: '\n  Grandma\'s apple pie  \nFlaky crust, tart apples.' });
  assert.equal(filled.status, 'filled');
  assert.equal(filled.name, 'Grandma\'s apple pie');
  assert.match(filled.message, /name was empty/);

  // A long first line is cut to 100 characters.
  assert.equal(C.checkRecipeName({ name: '', description: 'y'.repeat(150) }).name.length, 100);

  // Empty name and no description → can't be saved.
  const blocked = C.checkRecipeName({ name: '', description: '  \n ' });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.message, 'Give the recipe a name before saving.');
});

/* FR-2 */
test('search_matches_all_terms', () => {
  const recipes = [
    { name: 'Pancakes', ingredients: ['Flour', 'Eggs', 'Milk', 'Butter'] },
    { name: 'Omelette', ingredients: ['Eggs', 'Butter', 'Cheese'] },
    { name: 'Garlic Bread', ingredients: ['Bread', 'Butter', 'Garlic'] },
  ];
  const find = (q, scope) => recipes.filter((r) => C.matchesSearch(r, C.searchTerms(q), scope)).map((r) => r.name);

  assert.deepEqual(find('eggs, butter'), ['Pancakes', 'Omelette']);           // every term must match
  assert.deepEqual(find('EGGS, Milk'), ['Pancakes']);                          // any letter case
  assert.deepEqual(find('eggs, garlic'), []);                                  // no recipe has both
  assert.deepEqual(find('garlic, BREAD', 'name'), ['Garlic Bread']);
  assert.deepEqual(find('bread', 'ingredients'), ['Garlic Bread']);
  assert.deepEqual(find('pancakes', 'ingredients'), []);                       // names aren't searched here
  assert.deepEqual(find('egg'), ['Pancakes', 'Omelette']);                     // "egg" finds "Eggs"
  assert.deepEqual(find(''), ['Pancakes', 'Omelette', 'Garlic Bread']);        // empty search shows all
});

/* FR-3, US-1 colours */
test('missing ingredients are listed first: need (red), on a list (yellow), have (blue)', () => {
  // The example from user story US-1.
  const fridge = ['Eggs', 'Flour', 'Bananas', 'Ketchup'];
  const lists = [
    { id: 'a', name: 'List A', items: [{ name: 'Butter', done: false }] },
    { id: 'b', name: 'List B', items: [{ name: 'Milk', done: false }] },
  ];
  const recipe = { ingredients: ['Butter', 'Milk', 'Eggs', 'Flour', 'Baking soda', 'Salt'], useFridge: true };
  const rows = C.ingredientRows(recipe, fridge, lists);
  assert.deepEqual(rows.map((r) => [r.name, r.state]), [
    ['Baking soda', 'need'], ['Salt', 'need'],
    ['Butter', 'listed'], ['Milk', 'listed'],
    ['Eggs', 'have'], ['Flour', 'have'],
  ]);
  assert.deepEqual(rows[2].lists, ['List A']);

  // A recipe with the fridge check turned off shows everything plain, in its own order.
  assert.deepEqual(C.ingredientRows({ ...recipe, useFridge: false }, fridge, lists).map((r) => r.state), Array(6).fill('plain'));
});

/* FR-4, US-1 */
test('add_missing_no_duplicates', () => {
  const setup = () => ({
    fridge: ['Eggs', 'Flour', 'Bananas', 'Ketchup'],
    lists: [
      { id: 'a', name: 'List A', items: [{ name: 'Butter', done: false }] },
      { id: 'b', name: 'List B', items: [{ name: 'Milk', done: false }] },
    ],
  });
  const recipe = { ingredients: ['Butter', 'Milk', 'Eggs', 'Flour', 'Baking soda', 'Salt'], useFridge: true };
  const names = (list) => list.items.map((i) => i.name);

  // Only the list with milk → baking soda, salt and butter are added to it.
  let { fridge, lists } = setup();
  let added = C.addToLists(lists, ['b'], C.neededFor(recipe, fridge));
  assert.deepEqual(names(lists[1]).sort(), ['Baking soda', 'Butter', 'Milk', 'Salt']);
  assert.deepEqual(names(lists[0]), ['Butter']);
  assert.deepEqual(added, { b: 3 });

  // Both lists → each gets what it doesn't already have.
  ({ fridge, lists } = setup());
  added = C.addToLists(lists, ['a', 'b'], C.neededFor(recipe, fridge));
  assert.deepEqual(names(lists[0]).sort(), ['Baking soda', 'Butter', 'Milk', 'Salt']);
  assert.deepEqual(names(lists[1]).sort(), ['Baking soda', 'Butter', 'Milk', 'Salt']);
  assert.deepEqual(added, { a: 3, b: 3 });

  // Pressing it again adds nothing; any letter case counts as the same item.
  added = C.addToLists(lists, ['a', 'b'], ['baking SODA', 'Salt', 'Salt']);
  assert.deepEqual(added, { a: 0, b: 0 });
  assert.equal(lists[0].items.length, 4);

  // An item already bought (checked off) can go on the list again.
  lists[0].items.find((i) => i.name === 'Salt').done = true;
  assert.deepEqual(C.addToLists(lists, ['a'], ['Salt']), { a: 1 });
});

/* US-1: search results */
test('search results: recipes you can make come first', () => {
  const fridge = ['Eggs', 'Milk'];
  const recipes = [
    { name: 'Pancakes', ingredients: ['Eggs', 'Milk', 'Flour'], favorite: true },
    { name: 'Scrambled eggs', ingredients: ['Eggs', 'Milk'] },
    { name: 'Egg nog', ingredients: ['Eggs', 'Milk'], favorite: true },
    { name: 'Omelette', ingredients: ['Eggs', 'Cheese'] },
  ];
  assert.deepEqual(C.orderResults(recipes, fridge).map((r) => r.name), ['Egg nog', 'Scrambled eggs', 'Pancakes', 'Omelette']);
});

test('estimated time is read in minutes', () => {
  assert.equal(C.recipeMinutes({ time: '1 hr 15 min' }), 75);
  assert.equal(C.recipeMinutes({ time: '45 minutes' }), 45);
  assert.equal(C.recipeMinutes({ time: '30' }), 30);
  assert.equal(C.recipeMinutes({ time: '' }), 0);
});

/* NFR-1 */
test('parser_50kb_under_10s', async () => {
  // A long food blog: 50 KB of story around a real recipe.
  const article = fs.readFileSync(path.join(__dirname, 'articles', 'blog-cookies.txt'), 'utf8');
  const story = 'Every winter my grandmother baked for the whole street, and this is the recipe I grew up with. ';
  let text = '';
  while (Buffer.byteLength(text + article) < 50 * 1024) text += story;
  const page = `${text}\n\n${article}\n\n${text.slice(0, 2000)}`;
  assert.ok(Buffer.byteLength(page) >= 50 * 1024);

  let t = performance.now();
  const pasted = parseRecipe(page);
  const pasteMs = performance.now() - t;
  assert.ok(pasted.ingredients.length >= 8, 'found the ingredients');
  assert.ok(pasteMs <= 10000, `pasted text took ${Math.round(pasteMs)} ms`);

  // The same page fetched from a link (the server reads it as HTML).
  const html = `<html><body><h1>Chewy Brown Butter Chocolate Chip Cookies</h1>${page.split('\n').map((l) => `<p>${l}</p>`).join('')}</body></html>`;
  t = performance.now();
  const { recipe } = await importFromUrl('https://blog.example/cookies', { text: async () => html });
  const linkMs = performance.now() - t;
  assert.ok(recipe.ingredients.length >= 8);
  assert.ok(linkMs <= 10000, `link import took ${Math.round(linkMs)} ms`);
});
