// Short ingredient names for every import (names.js). Run: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const { shorten, shortenAll, matchKey } = require('../names.js');
const C = require('../cookbook.js');

const short = (n) => shorten(n).name;

test('everyday products lose the words that don\'t change what you buy', () => {
  const cases = {
    'All-purpose flour': 'Flour', 'all purpose flour': 'Flour', 'Unbleached all-purpose flour': 'Flour',
    'Granulated sugar': 'Sugar', 'Dark brown sugar': 'Brown sugar', 'Unsalted butter': 'Butter',
    'Kosher salt': 'Salt', 'Flaky sea salt': 'Salt', 'Freshly ground black pepper': 'Black pepper',
    'Extra-virgin olive oil': 'Olive oil', 'extra virgin olive oil': 'Olive oil', 'Large eggs': 'Eggs',
    'Pure vanilla extract': 'Vanilla extract', 'Semi-sweet chocolate chips': 'Chocolate chips',
    'Baby potatoes': 'Potatoes', 'Russet potatoes': 'Potatoes', 'Yellow onion': 'Onion',
    'Fresh flat-leaf parsley': 'Parsley', 'Ground cinnamon': 'Cinnamon', 'Whole milk': 'Milk',
    'Heavy whipping cream': 'Heavy cream', 'Boneless skinless chicken breasts': 'Chicken breasts',
    'Low-sodium chicken broth': 'Chicken broth', 'Lean ground beef': 'Ground beef', 'Corn starch': 'Cornstarch',
    'Freshly squeezed lemon juice': 'Lemon juice', 'Organic baby spinach': 'Spinach', 'Fresh basil leaves': 'Basil leaves',
  };
  for (const [long, want] of Object.entries(cases)) assert.equal(short(long), want, long);
});

test('cheeses are called by their name', () => {
  assert.equal(short('Shredded Parmesan cheese'), 'Parmesan');
  assert.equal(short('Parmigiano-Reggiano'), 'Parmesan');
  assert.equal(short('Mozzarella cheese'), 'Mozzarella');
  assert.equal(short('Sharp cheddar cheese'), 'Cheddar');
  assert.equal(short('Crumbled goat cheese'), 'Goat cheese');
});

test('different products are never merged', () => {
  for (const n of ['Bread flour', 'Whole wheat flour', 'Self-rising flour', 'Flour tortillas', 'Brown sugar', 'Powdered sugar',
    'Peanut butter', 'Sweet potatoes', 'Red onion', 'Cream cheese', 'Cottage cheese', 'Coconut milk', 'Buttermilk', 'Garlic powder',
    'Cherry tomatoes', 'White wine', 'Sea bass', 'Dark chocolate', 'Chicken broth', 'Ground beef', 'Salmon fillets', 'Water']) {
    assert.equal(short(n), n, n);
  }
});

test('words worth knowing move into the amount; noise words are dropped', () => {
  assert.deepEqual(shorten('All-purpose flour'), { name: 'Flour', note: 'all-purpose' });
  assert.deepEqual(shorten('Pure vanilla extract'), { name: 'Vanilla extract', note: '' });
  const r = shortenAll(['Unsalted butter', 'All-purpose flour', 'Kosher salt', 'Flaky sea salt'],
    { 'unsalted butter': '1 cup (226g), softened', 'all-purpose flour': '2 1/4 cups', 'kosher salt': '1 tsp', 'flaky sea salt': 'for topping' });
  assert.deepEqual(r.ingredients, ['Butter', 'Flour', 'Salt']);
  assert.deepEqual(r.amounts, { butter: '1 cup (226g), unsalted, softened', flour: '2 1/4 cups, all-purpose', salt: '1 tsp, kosher + flaky sea, for topping' });
});

test('fridge check and lists: short names, any plural, same ingredient', () => {
  assert.equal(matchKey('Eggs'), matchKey('Egg'));
  assert.equal(matchKey('Unsalted butter'), matchKey('Butter'));
  assert.equal(matchKey('Mozzarella cheese'), matchKey('Mozzarella'));
  assert.notEqual(matchKey('Brown sugar'), matchKey('Sugar'));
  assert.notEqual(matchKey('Peanut butter'), matchKey('Butter'));
  // A recipe imported with "1 egg" is "have" when the fridge says "Eggs".
  const recipe = { ingredients: ['Egg', 'Flour', 'Brown sugar'], useFridge: true };
  assert.deepEqual(C.neededFor(recipe, ['Eggs', 'All-purpose flour', 'Sugar']), ['Brown sugar']);
  // …and isn't added to a list that already has "Eggs".
  const lists = [{ id: 'a', items: [{ name: 'Eggs', done: false }] }];
  assert.deepEqual(C.addToLists(lists, ['a'], ['Egg', 'Butter']), { a: 1 });
});
