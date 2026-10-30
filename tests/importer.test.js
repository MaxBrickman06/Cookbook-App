// Link import tests. No internet needed: every website is faked with files in tests/pages.
// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { importFromUrl, detectSource, isoDuration } = require('../importer.js');

const page = (f) => fs.readFileSync(path.join(__dirname, 'pages', f), 'utf8');

/** A fake network: maps URLs (or URL prefixes) to responses. Anything else fails like a 404. */
function fakeNet(routes) {
  const find = (url) => {
    const key = Object.keys(routes).find((k) => url === k || url.startsWith(k));
    if (!key) throw new Error('the site answered 404');
    return typeof routes[key] === 'function' ? routes[key](url) : routes[key];
  };
  return {
    calls: [],
    async text(url) { this.calls.push(url); return find(url); },
    async json(url) { this.calls.push(url); return JSON.parse(find(url)); },
    async resolve(url) { this.calls.push(url); return find(url); },
  };
}
const steps = (r) => r.directions.split('\n').filter((l) => /^\d+\. /.test(l));

test('detects platforms from the many shapes of share links', () => {
  const cases = {
    'https://youtu.be/abcdefghijk?si=xyz': 'youtube',
    'https://www.youtube.com/shorts/abcdefghijk': 'youtube',
    'https://m.youtube.com/watch?v=abcdefghijk&t=30s': 'youtube',
    'https://vm.tiktok.com/ZMabc123/': 'tiktok',
    'https://www.tiktok.com/@chef/video/7312345678901234567?is_from_webapp=1': 'tiktok',
    'https://www.instagram.com/reel/C9xYz12AbC/?igsh=abc': 'instagram',
    'https://www.instagram.com/p/C9xYz12AbC/': 'instagram',
    'https://www.seriouseats.com/the-best-chili': 'article',
  };
  for (const [url, platform] of Object.entries(cases)) assert.equal(detectSource(url).platform, platform, url);
  assert.equal(detectSource('https://www.youtube.com/shorts/abcdefghijk').id, 'abcdefghijk');
  assert.equal(detectSource('https://www.instagram.com/reel/C9xYz12AbC/?igsh=abc').code, 'C9xYz12AbC');
  assert.equal(detectSource('not a link'), null);
  assert.equal(detectSource('ftp://example.com/file'), null);
  assert.equal(isoDuration('PT1H30M'), '1 hr 30 min');
});

test('recipe website: uses the page\'s built-in recipe data', async () => {
  const net = fakeNet({ 'https://simplyweeknight.example/lemon-chicken': page('article-jsonld.html') });
  const { recipe, via } = await importFromUrl('https://simplyweeknight.example/lemon-chicken', net);
  assert.equal(via, 'recipe data');
  assert.equal(recipe.name, 'Lemon Herb Chicken & Potatoes');
  assert.ok(recipe.ingredients.includes('Potatoes'));                 // short names: "baby potatoes" → Potatoes
  assert.ok(recipe.ingredients.includes('Chicken thighs'));
  assert.ok(recipe.ingredients.includes('Black pepper'));
  assert.equal(recipe.amounts['olive oil'], '3 tablespoons, divided');
  assert.equal(steps(recipe).length, 4);
  assert.match(recipe.directions, /^Prep:\n1\. Heat the oven to 425°F\./);
  assert.match(recipe.directions, /\n\nRoast:\n3\. /);
  assert.match(recipe.description, /½ the dishes/);
  assert.match(recipe.description, /Prep time: 15 min · Cook time: 45 min · Total time: 1 hr · Servings: 4/);
  assert.equal(recipe.time, '1 hr');
  assert.equal(recipe.image, 'https://cdn.example.com/lc-4x3.jpg');
  assert.equal(recipe.source, 'https://simplyweeknight.example/lemon-chicken');
});

test('recipe website without recipe data: reads the page text', async () => {
  const net = fakeNet({ 'https://simplyweeknight.example/garlic-noodles': page('linked-recipe.html') });
  const { recipe, via } = await importFromUrl('https://simplyweeknight.example/garlic-noodles', net);
  assert.equal(via, 'page text');
  assert.equal(recipe.name, '10 Minute Garlic Noodles');
  assert.deepEqual(recipe.ingredients, ['Spaghetti', 'Butter', 'Garlic', 'Soy sauce', 'Brown sugar']);
  assert.equal(steps(recipe).length, 3);
  assert.equal(recipe.image, 'https://simplyweeknight.example/noodles.jpg');
});

test('YouTube Short: recipe from the description, chapters and links dropped', async () => {
  const net = fakeNet({ 'https://www.youtube.com/watch?v=abcdefghijk': page('youtube-watch.html') });
  const { recipe, platform } = await importFromUrl('https://youtube.com/shorts/abcdefghijk?feature=share', net);
  assert.equal(platform, 'youtube');
  assert.equal(recipe.name, 'CRISPY Smashed Potatoes');
  assert.deepEqual(recipe.ingredients, ['Potatoes', 'Olive oil', 'Garlic powder', 'Parmesan', 'Salt']);
  assert.equal(steps(recipe).length, 4);
  assert.doesNotMatch(recipe.directions, /Intro|Subscribe|amzn/);
  assert.match(recipe.description, /Imported from YouTube · @Kitchen Kev/);
  assert.equal(recipe.image, 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg');
});

test('YouTube API key is used when set', async () => {
  const api = JSON.stringify({ items: [{ snippet: { title: 'Pesto Pasta', channelTitle: 'Chef', description: 'Ingredients:\n2 cups basil\n1/2 cup olive oil\n12 oz pasta\nInstructions:\n1. Blend the basil and oil.\n2. Toss with the pasta.' } }] });
  const net = fakeNet({ 'https://www.googleapis.com/youtube/v3/videos': api });
  const { recipe } = await importFromUrl('https://youtu.be/abcdefghijk', net, { YOUTUBE_API_KEY: 'k' });
  assert.equal(recipe.name, 'Pesto Pasta');
  assert.deepEqual(recipe.ingredients, ['Basil', 'Olive oil', 'Pasta']);
  assert.ok(!net.calls.some((u) => u.includes('watch?v=')));
});

test('video that only links to the recipe: follows the link', async () => {
  const net = fakeNet({
    'https://www.youtube.com/watch?v=zzzzzzzzzzz': page('youtube-linkonly.html'),
    'https://simplyweeknight.example/garlic-noodles': page('linked-recipe.html'),
  });
  const { recipe, via } = await importFromUrl('https://www.youtube.com/watch?v=zzzzzzzzzzz', net);
  assert.equal(via, 'recipe linked in the YouTube description');
  assert.equal(recipe.ingredients.length, 5);
  assert.match(recipe.description, /Full recipe: https:\/\/simplyweeknight\.example\/garlic-noodles/);
  assert.ok(!net.calls.some((u) => u.includes('instagram.com')));
});

test('TikTok short link: resolves it, then reads the caption from oEmbed', async () => {
  const caption = 'Cheesy garlic potato bites 🥔🧀 Ingredients: 4 russet potatoes, 1 cup shredded mozzarella, 1/2 cup parmesan, 1 tsp garlic powder, 1 egg, 3 tbsp cornstarch, salt and pepper to taste. Instructions: 1. Boil and mash the potatoes 2. Mix in everything except mozzarella 3. Wrap around a mozzarella cube and roll 4. Fry at 350F until golden #potato #fyp';
  const full = 'https://www.tiktok.com/@cheflily/video/7312345678901234567';
  const net = fakeNet({
    'https://vm.tiktok.com/ZMabc123/': full,
    'https://www.tiktok.com/oembed?url=': (u) => {
      assert.equal(new URL(u).searchParams.get('url'), full);
      return JSON.stringify({ title: caption, author_unique_id: 'cheflily', thumbnail_url: 'https://p16.tiktokcdn.com/thumb.jpg' });
    },
  });
  const { recipe, platform } = await importFromUrl('https://vm.tiktok.com/ZMabc123/', net);
  assert.equal(platform, 'tiktok');
  assert.equal(recipe.name, 'Cheesy garlic potato bites');
  assert.deepEqual(recipe.ingredients, ['Potatoes', 'Mozzarella', 'Parmesan', 'Garlic powder', 'Egg', 'Cornstarch', 'Salt', 'Pepper']);
  assert.equal(steps(recipe).length, 4);
  assert.match(recipe.description, /Imported from TikTok · @cheflily/);
  assert.equal(recipe.image, 'https://p16.tiktokcdn.com/thumb.jpg');
});

test('TikTok caption without a recipe gives a clear message and the caption', async () => {
  const net = fakeNet({ 'https://www.tiktok.com/oembed?url=': JSON.stringify({ title: 'POV: you finally nailed the sourdough 😭 #bread', author_unique_id: 'x' }) });
  await assert.rejects(importFromUrl('https://www.tiktok.com/@x/video/1', net), (e) => {
    assert.equal(e.code, 'no-recipe');
    assert.match(e.message, /^No recipe found on that page/);
    assert.match(e.caption, /sourdough/);
    return true;
  });
});

test('Instagram reel: caption from the embed page', async () => {
  const net = fakeNet({ 'https://www.instagram.com/p/C9xYz12AbC/embed/captioned/': page('instagram-embed.html') });
  const { recipe } = await importFromUrl('https://www.instagram.com/reel/C9xYz12AbC/?igsh=abc', net);
  assert.equal(recipe.name, '3-ingredient banana oat cookies');
  assert.deepEqual(recipe.ingredients, ['Bananas', 'Rolled oats', 'Chocolate chips']);
  assert.equal(steps(recipe).length, 4);
  assert.match(recipe.description, /@bakewithbea/);
  assert.equal(recipe.image, 'https://scontent.cdninstagram.com/v/reel.jpg?a=1&b=2');
});

test('Instagram fallback: caption from the post page preview text', async () => {
  const net = fakeNet({ 'https://www.instagram.com/reel/C1abc/': page('instagram-page.html') });
  const { recipe } = await importFromUrl('https://www.instagram.com/reel/C1abc/', net);
  assert.deepEqual(recipe.ingredients, ['Spaghetti', 'Pecorino', 'Black pepper']);
  assert.equal(recipe.amounts.spaghetti, '200 g');
  assert.equal(steps(recipe).length, 1);
});

test('Instagram with no caption available explains what to do instead', async () => {
  await assert.rejects(importFromUrl('https://www.instagram.com/p/PRIVATE1/', fakeNet({})), /copy the caption and paste it into Import → Text/);
});

test('bad links', async () => {
  await assert.rejects(importFromUrl('hello', fakeNet({})), { code: 'invalid-link', message: /^Enter a full link starting with http/ });
  await assert.rejects(importFromUrl('www.example.com/recipe', fakeNet({})), { code: 'invalid-link' });
  await assert.rejects(importFromUrl('ftp://example.com/recipe', fakeNet({})), { code: 'invalid-link' });
  await assert.rejects(importFromUrl('https://blocked.example/x', fakeNet({})), { code: 'unreachable', message: /^Couldn't reach that page \(the site answered 404\)/ });
});

test('use case 4a: a page with no ingredient list is refused with "No recipe found on that page"', async () => {
  const net = fakeNet({ 'https://blog.example/about': '<html><body><h1>About me</h1><p>I love cooking for my family.</p></body></html>' });
  await assert.rejects(importFromUrl('https://blog.example/about', net), { code: 'no-recipe', message: 'No recipe found on that page' });
});

test('use case 4b: a page with ingredients but no directions still imports, with directions empty', async () => {
  const html = '<html><body><h1>Trail Mix</h1><h2>Ingredients</h2><ul><li>1 cup peanuts</li><li>1 cup raisins</li><li>1/2 cup chocolate chips</li></ul></body></html>';
  const { recipe } = await importFromUrl('https://blog.example/trail-mix', fakeNet({ 'https://blog.example/trail-mix': html }));
  assert.equal(recipe.name, 'Trail Mix');
  assert.equal(recipe.ingredients.length, 3);
  assert.equal(recipe.directions, '');
});

test('real video description (from the design sketch screenshot) imports exactly', async () => {
  // Transcribed from the "Cheesy Garlic Potato Bites Fried" video description in Cookbook App Design.pdf.
  const description = page('real-video-description.txt');
  const watch = `<script>var ytInitialPlayerResponse = ${JSON.stringify({ videoDetails: {
    videoId: 'abcdefghijk', title: 'Cheesy Garlic Potato Bites Fried #recipe #easyrecipe #food', author: 'creator', shortDescription: description,
  } })};</script>`;
  const net = fakeNet({ 'https://www.youtube.com/watch?v=abcdefghijk': watch });
  const { recipe } = await importFromUrl('https://youtube.com/shorts/abcdefghijk', net);
  assert.equal(recipe.name, 'Cheesy Garlic Potato Bites Fried');
  assert.deepEqual(recipe.ingredients, ['Potatoes', 'Butter', 'Parmesan', 'Salt', 'Garlic powder', 'Parsley', 'Cornstarch', 'Egg', 'Mozzarella', 'Oil']);
  assert.equal(recipe.amounts.parmesan, '1/3 cup');
  assert.equal(recipe.amounts.oil, 'for frying');
  assert.equal(steps(recipe).length, 5);
  assert.match(recipe.directions, /^1\. Peel and slice potatoes\. Boil until tender \(until a fork can easily pierce the surface\)\n2\. Mash/);
  assert.match(recipe.directions, /5\. Deep fry in 350° oil until golden and crispy\.$/);
});
