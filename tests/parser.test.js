// Checks the text scanner against real-looking pasted articles.
// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseRecipe, parseIngredientLine } = require('../parser.js');

const article = (f) => parseRecipe(fs.readFileSync(path.join(__dirname, 'articles', f), 'utf8'));
const stepCount = (r) => r.directions.split('\n').filter((l) => /^\d+\. /.test(l)).length;

test('ingredient lines: amounts, units and notes split from the name', () => {
  const cases = [
    ['1 ½ cups (190g) all-purpose flour, sifted', 'All-purpose flour', '1 1/2 cups (190g), sifted'],
    ['2 large eggs, at room temperature', 'Eggs', '2 large, at room temperature'],
    ['1 (14-ounce) can coconut milk', 'Coconut milk', '1 (14-ounce) can'],
    ['Juice of 1 lemon', 'Lemon', 'juice of 1'],
    ['1 cup + 2 tbsp granulated sugar', 'Granulated sugar', '1 cup + 2 tbsp'],
    ['½ cup half and half', 'Half and half', '1/2 cup'],
    ['3 cloves garlic, minced', 'Garlic', '3 cloves, minced'],
    ['1/4 cup olive oil or vegetable oil', 'Olive oil', '1/4 cup, or vegetable oil'],
    ['A pinch of cayenne', 'Cayenne', 'a pinch'],
    ['Kosher salt', 'Kosher salt', ''],
  ];
  for (const [line, name, amount] of cases) {
    assert.deepEqual(parseIngredientLine(line)[0], { name, amount }, line);
  }
  assert.deepEqual(parseIngredientLine('Salt and pepper, to taste').map((x) => x.name), ['Salt', 'Pepper']);
});

test('food blog: skips the story and reads the recipe card', () => {
  const r = article('blog-cookies.txt');
  assert.equal(r.name, 'Chewy Brown Butter Chocolate Chip Cookies');
  assert.equal(r.ingredients.length, 11);
  assert.equal(r.ingredients[0], 'Unsalted butter');
  assert.ok(!r.ingredients.some((n) => /metric|brown butter:/i.test(n)));
  assert.equal(stepCount(r), 6);
  assert.match(r.description, /Prep time: 15 minutes/);
  assert.match(r.description, /Notes:/);
  assert.doesNotMatch(r.directions, /Megan|Calories/);
});

test('"Step 1" style directions with photo credits in between', () => {
  const r = article('allrecipes-curry.txt');
  assert.equal(r.name, 'Easy Chicken Curry');
  assert.ok(r.ingredients.includes('Boneless skinless chicken thighs'));
  assert.ok(r.ingredients.includes('Diced tomatoes'));
  assert.equal(stepCount(r), 5);
  assert.doesNotMatch(r.directions, /Dotdash/);
});

test('grouped ingredients and directions keep their sub-headings out of the list', () => {
  const r = article('grouped-lasagna.txt');
  assert.equal(r.name, 'Weeknight Skillet Lasagna');
  assert.ok(!r.ingredients.some((n) => /^for the/i.test(n)));
  assert.ok(r.ingredients.includes('Crushed tomatoes'));
  assert.ok(r.ingredients.includes('Black pepper'));
  assert.equal(stepCount(r), 4);
  assert.match(r.directions, /^For the sauce:/);
});

test('no section headings at all', () => {
  const r = article('no-headings-salsa.txt');
  assert.equal(r.name, 'Fresh Mango Salsa');
  assert.deepEqual(r.ingredients, ['Mangoes', 'Red onion', 'Jalapeño', 'Cilantro', 'Limes', 'Salt']);
  assert.equal(stepCount(r), 3);
});

test('simple hand-typed format still works', () => {
  const r = article('simple.txt');
  assert.equal(r.name, 'Garlic Butter Noodles');
  assert.deepEqual(r.ingredients, ['Spaghetti', 'Butter', 'Garlic', 'Parmesan cheese']);
  assert.equal(r.directions, '1. Boil the pasta. Melt butter with garlic, toss together, top with parmesan.');
});
