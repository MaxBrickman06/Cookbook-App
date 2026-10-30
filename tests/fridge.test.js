// Load fridge from image (scanner.js): matching, suggestions, and the optional Gemini request. Run: node --test
// Gemini is never called for real here: a fake fetch plays its part.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../scanner.js');

const PHOTO = 'data:image/jpeg;base64,/9j/AAAA';
const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const answer = (items) => reply(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(items) }] } }] });

test('items found in a photo land on the names the cook already uses', () => {
  const known = ['Eggs', 'Mozzarella', 'Parmesan cheese', 'Romaine lettuce', 'Butter', 'Cream cheese'];
  const out = S.matchToKnown(['Large brown eggs', 'Shredded Mozzarella', 'romaine', 'cream cheese', 'Sour cream', 'eggs', ''], known);
  assert.deepEqual(out.map((o) => o.name), ['Eggs', 'Mozzarella', 'Romaine lettuce', 'Cream cheese', 'Sour cream']);
  assert.equal(out[0].found, 'Large brown eggs');
});

test('suggestions: shopping lists first, then recipes, then staples — never what is already in the fridge', () => {
  const sug = S.fridgeSuggestions(
    [{ ingredients: ['Flour', 'Eggs', 'Butter'] }],
    [{ items: [{ name: 'Bread', done: false }, { name: 'Jam', done: true }] }],
    ['Eggs'],
  );
  assert.deepEqual(sug.slice(0, 3), ['Bread', 'Flour', 'Butter']);
  assert.ok(!sug.includes('Eggs') && !sug.includes('Jam'));
  assert.ok(sug.includes('Milk'));
  assert.equal(new Set(sug.map((x) => x.toLowerCase())).size, sug.length);
});

test('gemini: sends the photo and the key, reads the list back', async () => {
  const calls = [];
  const items = await S.geminiFridgeItems(PHOTO, ' my-key ', async (url, opts) => { calls.push({ url, opts }); return answer(['Eggs', ' Sour cream ', '']); });
  assert.deepEqual(items, ['Eggs', 'Sour cream']);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, new RegExp(`/models/${S.GEMINI_MODELS[0]}:generateContent$`));
  assert.equal(calls[0].opts.headers['x-goog-api-key'], 'my-key');
  const sent = JSON.parse(calls[0].opts.body);
  assert.deepEqual(sent.contents[0].parts[1].inline_data, { mime_type: 'image/jpeg', data: '/9j/AAAA' });
  assert.equal(sent.generationConfig.responseMimeType, 'application/json');
});

test('gemini: a model that is not offered is skipped for the next one', async () => {
  const tried = [];
  const items = await S.geminiFridgeItems(PHOTO, 'k', async (url) => {
    tried.push(url);
    return tried.length === 1 ? reply(404, { error: { message: 'model not found' } }) : answer(['Milk']);
  });
  assert.deepEqual(items, ['Milk']);
  assert.equal(tried.length, 2);
});

test('gemini: what goes wrong is said plainly', async () => {
  const code = async (fetchFn, key = 'k', photo = PHOTO) => {
    try { await S.geminiFridgeItems(photo, key, fetchFn); return 'no error'; } catch (e) { return e.code; }
  };
  assert.equal(await code(async () => reply(400, { error: { message: 'API key not valid. Please pass a valid API key.' } })), 'key');
  assert.equal(await code(async () => reply(403, {})), 'key');
  assert.equal(await code(async () => reply(429, {})), 'quota');
  assert.equal(await code(async () => { throw new TypeError('Failed to fetch'); }), 'network');
  assert.equal(await code(async () => reply(200, { candidates: [{ content: { parts: [{ text: 'I see eggs' }] } }] })), 'answer');
  assert.equal(await code(async () => reply(404, {})), 'unavailable');
  assert.equal(await code(async () => answer([]), ''), 'key');
  assert.equal(await code(async () => answer([]), 'k', 'not a photo'), 'answer');
});
