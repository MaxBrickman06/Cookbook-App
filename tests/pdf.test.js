// PDF import (scanner.js + the vendored pdf.js + parser.js). Run: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const S = require('../scanner.js');
const { parseRecipe } = require('../parser.js');

let lib;
async function pdfjs() {
  if (!lib) {
    const log = console.log;
    console.log = () => {};          // pdf.js warns that Node has no canvas — only drawing needs one
    try { lib = await import(path.join(__dirname, '..', 'vendor', 'pdfjs', 'pdf.min.mjs')); } finally { console.log = log; }
    lib.GlobalWorkerOptions.workerSrc = path.join(__dirname, '..', 'vendor', 'pdfjs', 'pdf.worker.min.mjs');
  }
  return lib;
}

/** What the app does with a PDF: read it, find the recipe's pages, scan them. */
async function importPdf(file, which = 0) {
  const data = new Uint8Array(fs.readFileSync(path.join(__dirname, file)));
  const pdf = await S.readPdfText(await pdfjs(), data);
  const pageTexts = pdf.pages.map((p, i) => S.joinPages(pdf.pages, i, i));
  const recipes = S.findRecipePages(pageTexts);
  const r = recipes[which] || { from: 0, to: pdf.pages.length - 1 };
  return { recipes, pageTexts, recipe: parseRecipe(S.joinPages(pdf.pages, r.from, r.to)) };
}

const steps = (r) => r.directions.split('\n').filter((l) => /^\d+\. /.test(l));

test('pdf: one-column recipe card', async () => {
  const { recipe } = await importPdf('../demo/brown-butter-cookies.pdf');
  assert.equal(recipe.name, 'Chewy Brown Butter Chocolate Chip Cookies');
  assert.equal(recipe.ingredients.length, 11);
  assert.equal(recipe.amounts['unsalted butter'], '1 cup (226g)');
  assert.equal(steps(recipe).length, 6);
  assert.match(steps(recipe)[0], /swirling, until it smells nutty .* cool for 10 minutes\.$/);   // a wrapped step is one step
  assert.equal(recipe.time, '27 min');
  assert.match(recipe.description, /brown the butter slowly/);                                 // "Notes:" goes to the description
});

test('pdf: two columns — ingredients beside directions — read column by column', async () => {
  const { recipe } = await importPdf('pdfs/two-column.pdf');
  assert.equal(recipe.name, 'Weeknight Chicken Fajitas');
  assert.deepEqual(recipe.ingredients, ['Chicken breast', 'Bell peppers', 'Onion', 'Olive oil', 'Chili powder', 'Cumin', 'Garlic powder', 'Lime', 'Flour tortillas']);
  assert.equal(steps(recipe).length, 5);
  assert.equal(steps(recipe)[0], '1. Toss the chicken with the oil, chili powder, cumin and garlic powder.');
});

test('pdf: a blog page saved with Print → Save as PDF (menu, browser stamps, comments)', async () => {
  const { recipe } = await importPdf('pdfs/blog-print.pdf');
  assert.equal(recipe.name, 'The Best Lemon Garlic Salmon');
  assert.equal(recipe.ingredients.length, 7);
  assert.equal(steps(recipe).length, 5);
  assert.equal(recipe.time, '20 min');
  assert.doesNotMatch(recipe.directions + recipe.description, /Instagram|Sarah|Privacy|PM/);
});

test('pdf: a cookbook — finds the recipe on pages 5–6 among the intro and index', async () => {
  const { recipes, recipe } = await importPdf('pdfs/cookbook-8-pages.pdf');
  assert.deepEqual(recipes, [{ from: 4, to: 5 }]);
  assert.equal(recipe.name, 'Grandma’s Banana Bread');
  assert.equal(recipe.ingredients.length, 8);
  assert.equal(steps(recipe).length, 5);
});

test('pdf: several recipes in one PDF are offered separately', async () => {
  const all = await importPdf('pdfs/cookbook-3-recipes.pdf');
  assert.deepEqual(all.recipes, [{ from: 1, to: 1 }, { from: 2, to: 2 }, { from: 3, to: 3 }]);
  const soup = (await importPdf('pdfs/cookbook-3-recipes.pdf', 1)).recipe;
  assert.equal(soup.name, 'Tomato Basil Soup');
  assert.equal(soup.ingredients.length, 6);
  assert.equal(steps(soup).length, 3);
});

test('pdf: a scanned page has no text; a damaged file is reported', async () => {
  const { pageTexts } = await importPdf('pdfs/scanned-image-only.pdf');
  assert.equal(pageTexts.join('').trim(), '');
  await assert.rejects(S.readPdfText(await pdfjs(), new Uint8Array(Buffer.from('%PDF-1.4 this is not really a pdf'))), (e) => e.code === 'unreadable');
});

test('pdf lines: word pieces join, wide gaps split, wrapped lines rejoin, titles stay apart', () => {
  const it = (str, x, y, w, h = 10) => ({ str, x, y, w, h });
  const lines = S.buildPageLines([
    it('Big Title That Is Long', 50, 700, 500, 22),
    it('A subtitle.', 50, 680, 60),
    it('a', 50, 650, 5), it('b', 55, 650, 5), it('out', 60, 650, 15), it('the', 80, 650, 15),
    it('1. A step that runs all the way to the', 50, 620, 500),
    it('edge and continues.', 50, 608, 90),
    it('2. Next step.', 50, 596, 60),
    it('Prep 5 min', 50, 560, 50), it('Cook 10 min', 300, 560, 55),
  ], 612).filter((l) => !l.blank).map((l) => l.text);
  assert.deepEqual(lines, ['Big Title That Is Long', 'A subtitle.', 'about the',
    '1. A step that runs all the way to the edge and continues.', '2. Next step.', 'Prep 5 min', 'Cook 10 min']);
});
