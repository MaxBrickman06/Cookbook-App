/* Cookbook App — import a recipe from a link (runs on the Node server, see server.js)
 *
 *   Recipe websites  → the page's built-in recipe data (schema.org JSON-LD), or the page text
 *   TikTok           → the video caption, via TikTok's public oEmbed endpoint
 *   Instagram        → the post/reel caption, via Instagram's public embed page
 *   YouTube / Shorts → the video description (YouTube Data API if a key is set, else the public watch page)
 *
 * Every network call goes through the `net` object passed in, so tests can run offline
 * with fake responses (see tests/importer.test.js) and server.js supplies the real one.
 */
'use strict';

const { parseRecipe, parseIngredientLine, formatMinutes } = require('./parser.js');
const { shortenAll } = require('./names.js');

/* ---------------- what kind of link is this? ---------------- */

function detectSource(raw) {
  let url;
  try { url = new URL(String(raw).trim()); } catch (e) { return null; }
  if (!/^https?:$/.test(url.protocol)) return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile|music)\./, '');
  const path = url.pathname;

  if (host === 'youtu.be') {
    const id = path.slice(1).split('/')[0];
    return /^[\w-]{11}$/.test(id) ? { platform: 'youtube', id, url: url.href } : null;
  }
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtube-nocookie.com') {
    const id = url.searchParams.get('v') || (path.match(/^\/(?:shorts|live|embed|v)\/([\w-]{11})/) || [])[1];
    return id && /^[\w-]{11}$/.test(id) ? { platform: 'youtube', id, url: url.href } : { platform: 'article', url: url.href };
  }
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    return { platform: 'tiktok', url: url.href, short: /^(vm|vt)\.tiktok\.com$/.test(url.hostname) || /^\/t\//.test(path) };
  }
  if (host === 'instagram.com' || host === 'instagr.am') {
    const code = (path.match(/\/(?:p|reels?|tv)\/([\w-]+)/) || [])[1];
    return code ? { platform: 'instagram', code, url: url.href } : null;
  }
  return { platform: 'article', url: url.href };
}

const PLATFORM_NAMES = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', article: 'the web' };

/* ---------------- small HTML helpers ---------------- */

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', deg: '°', frac12: '½', frac14: '¼', frac34: '¾',
  frac13: '⅓', frac23: '⅔', frac18: '⅛', times: '×', eacute: 'é', egrave: 'è', ntilde: 'ñ', bull: '•',
  middot: '·', reg: '®', copy: '©', trade: '™',
};

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+\d*);/gi, (m, n) => (NAMED[n.toLowerCase()] !== undefined ? NAMED[n.toLowerCase()] : m));
}
function safeChar(code) {
  try { return String.fromCodePoint(code); } catch (e) { return ''; }
}

/** Visible text of an HTML document, one block element per line. */
function htmlToText(html) {
  return decodeEntities(String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|nav|footer|aside|form|select|button|head)\b[\s\S]*?<\/\1>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/?(p|div|section|article|header|main|h[1-6]|ul|ol|li|tr|table|blockquote|figure|figcaption|dt|dd|label)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function metaContent(html, key) {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']`, 'i').exec(html);
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`, 'i').exec(html);
  const m = a || b;
  return m ? decodeEntities(m[1]).trim() : '';
}

/** Read one JSON object or array that starts at `start`, skipping over strings. */
function readJsonAt(text, start) {
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    } else if (c === open) {
      depth++;
    } else if (c === close && --depth === 0) {
      return text.slice(start, i + 1);
    }
  }
  return null;
}

/** JSON assigned in an inline script, e.g. `var ytInitialPlayerResponse = {...};` */
function jsonAfter(html, marker) {
  const at = html.indexOf(marker);
  if (at === -1) return null;
  const start = html.indexOf('{', at + marker.length);
  if (start === -1) return null;
  const raw = readJsonAt(html, start);
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

/** Contents of <script id="…" type="application/json">…</script>. */
function scriptJsonById(html, id) {
  const m = new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)</script>`, 'i').exec(html);
  try { return m ? JSON.parse(m[1]) : null; } catch (e) { return null; }
}

/* ---------------- recipe websites: schema.org JSON-LD ---------------- */

function findRecipeNode(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return null;
  if (Array.isArray(node)) {
    for (const n of node) { const r = findRecipeNode(n, depth + 1); if (r) return r; }
    return null;
  }
  const type = [].concat(node['@type'] || []).map(String);
  if (type.some((t) => /(^|\/)Recipe$/i.test(t))) return node;
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item', 'hasPart']) {
    const r = findRecipeNode(node[key], depth + 1);
    if (r) return r;
  }
  return null;
}

function jsonLdRecipe(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data;
    const body = m[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, '');
    try { data = JSON.parse(body); } catch (e) {
      try { data = JSON.parse(body.replace(/[\u0000-\u001f]+/g, ' ')); } catch (e2) { continue; }
    }
    const recipe = findRecipeNode(data);
    if (recipe) return recipe;
  }
  return null;
}

const plain = (s) => htmlToText(decodeEntities(String(s || ''))).replace(/\s*\n\s*/g, ' ').trim();

/** "PT1H30M" → 90 */
function isoMinutes(v) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/i.exec(String(v || '').trim());
  if (!m) return 0;
  return (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

/** "PT1H30M" → "1 hr 30 min" */
const isoDuration = (v) => formatMinutes(isoMinutes(v));

function firstImage(img) {
  if (!img) return '';
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return firstImage(img[img.length > 1 ? 1 : 0]) || firstImage(img[0]);
  return img.url || img.contentUrl || '';
}

function instructionsToDirections(ins) {
  const out = [];
  let n = 0;
  const step = (text) => {
    const t = plain(text).replace(/^(?:step\s*)?\d{1,2}[.):]\s*/i, '');
    if (t) out.push(`${++n}. ${t}`);
  };
  const walk = (x) => {
    if (!x) return;
    if (typeof x === 'string') {
      const parts = plain(x) ? x.split(/\n+|(?:<\/?(?:p|li|br)[^>]*>)+/i).map(plain).filter(Boolean) : [];
      (parts.length > 1 ? parts : [x]).forEach(step);
    } else if (Array.isArray(x)) x.forEach(walk);
    else if (/HowToSection/i.test([].concat(x['@type'] || []).join())) {
      if (x.name) out.push(`${out.length ? '\n' : ''}${plain(x.name).replace(/:?$/, ':')}`);
      walk(x.itemListElement || x.steps);
    } else if (x.itemListElement) walk(x.itemListElement);
    else step(x.text || x.name || x.description || '');
  };
  walk(ins);
  return out.join('\n').trim();
}

/** Turn ingredient lines into the app's { ingredients, amounts } shape. */
function ingredientsFromLines(lines) {
  const ingredients = [];
  const amounts = {};
  lines.map(plain).filter(Boolean).forEach((line) => {
    if (/:$/.test(line) && line.split(/\s+/).length <= 6) return; // "For the sauce:"
    parseIngredientLine(line).forEach(({ name, amount }) => {
      const key = name.toLowerCase();
      if (!ingredients.some((x) => x.toLowerCase() === key)) {
        ingredients.push(name);
        if (amount) amounts[key] = amount;
      } else if (amount) amounts[key] = amounts[key] ? `${amounts[key]} + ${amount}` : amount;
    });
  });
  return shortenAll(ingredients, amounts);   // "all-purpose flour" → Flour, like every other import
}

function recipeFromJsonLd(node) {
  const { ingredients, amounts } = ingredientsFromLines([].concat(node.recipeIngredient || node.ingredients || []));
  const meta = [
    isoDuration(node.prepTime) && `Prep time: ${isoDuration(node.prepTime)}`,
    isoDuration(node.cookTime) && `Cook time: ${isoDuration(node.cookTime)}`,
    isoDuration(node.totalTime) && `Total time: ${isoDuration(node.totalTime)}`,
    node.recipeYield && `Servings: ${plain([].concat(node.recipeYield)[0])}`,
  ].filter(Boolean).join(' · ');
  return {
    name: plain(node.name) || 'Imported recipe',
    description: [plain(node.description), meta].filter(Boolean).join('\n\n'),
    ingredients,
    amounts,
    directions: instructionsToDirections(node.recipeInstructions),
    image: firstImage(node.image),
    // Overall time: the stated total, otherwise prep + cook added up.
    time: isoDuration(node.totalTime) || formatMinutes(isoMinutes(node.prepTime) + isoMinutes(node.cookTime)),
  };
}

/* ---------------- captions → recipe ---------------- */

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

/** Description cleanup shared by all video platforms. */
function cleanCaption(text) {
  return String(text || '')
    .split('\n')
    .filter((l) => !/^\s*\(?\d{1,2}:\d{2}(?::\d{2})?\)?\s/.test(l))                              // YouTube chapters
    .filter((l) => !/^\s*(subscribe|follow( me)?|business inquiries|music|shop my|my (amazon|kitchen|gear)|instagram|tiktok|facebook|twitter|pinterest|website|blog|email)\b.*(:|https?:\/\/|@)/i.test(l))
    .map((l) => l.replace(URL_RE, '').replace(/\s+[-–|:]\s*$/, '').trimEnd())
    .join('\n')
    .trim();
}

/** Links in a caption that probably lead to the full written recipe. */
function recipeLinks(text) {
  const social = /(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|twitter\.com|x\.com|pinterest\.|amazon\.|amzn\.|linktr\.ee|bit\.ly\/?$|spotify\.|patreon\.|ltk\.|liketoknow)/i;
  const lines = String(text || '').split('\n');
  const scored = [];
  lines.forEach((line, i) => {
    (line.match(URL_RE) || []).forEach((u) => {
      if (social.test(u)) return;
      const near = `${lines[i - 1] || ''} ${line}`;
      scored.push({ url: u.replace(/[.,;]+$/, ''), score: /recipe|ingredients|printable|full/i.test(near) ? 2 : 1 });
    });
  });
  return scored.sort((a, b) => b.score - a.score).map((x) => x.url);
}

function cleanVideoTitle(t) {
  const s = String(t || '')
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, ' ')
    .replace(/(?:\p{Extended_Pictographic}|️|‍)+/gu, ' ')
    .split(/\s[|•]\s|\s[-–—]\s(?=[^-–—]*$)/)[0]
    .replace(/\s*\((?:easy|quick|best)?\s*recipe\)\s*$/i, '')
    .replace(/\s+recipe$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/[A-Z]{3}/.test(s) && !/[a-z]/.test(s)) {
    return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  }
  return s;
}

function recipeFromCaption(caption, { title = '', author = '' } = {}) {
  const cleaned = cleanCaption(caption);
  const text = title ? `${cleanVideoTitle(title)}\n${cleaned}` : cleaned;
  const r = parseRecipe(text);
  if (!r) return null;
  if (title && cleanVideoTitle(title)) r.name = cleanVideoTitle(title);
  if (!r.name || r.name === 'Imported recipe' || r.name.length > 70) {
    r.name = author ? `Recipe from @${author.replace(/^@/, '')}` : 'Imported recipe';
  }
  return r;
}

/* ---------------- platforms ---------------- */

async function fromYouTube(src, net, env) {
  const id = src.id;
  let title = '';
  let description = '';
  let author = '';
  if (env.YOUTUBE_API_KEY) {
    const api = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${encodeURIComponent(env.YOUTUBE_API_KEY)}`;
    const data = await net.json(api).catch(() => null);
    const sn = data && data.items && data.items[0] && data.items[0].snippet;
    if (sn) { title = sn.title; description = sn.description; author = sn.channelTitle; }
  }
  if (!description) {
    const html = await net.text(`https://www.youtube.com/watch?v=${id}&hl=en`, {
      headers: { Cookie: 'CONSENT=YES+cb; SOCS=CAI' },
    });
    const player = jsonAfter(html, 'ytInitialPlayerResponse') || {};
    const vd = player.videoDetails || {};
    title = title || vd.title || metaContent(html, 'og:title');
    description = vd.shortDescription || metaContent(html, 'og:description') || metaContent(html, 'description');
    author = author || vd.author || '';
  }
  return {
    title, caption: description, author,
    image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

async function fromTikTok(src, net) {
  let url = src.url;
  if (src.short) url = await net.resolve(url).catch(() => url);
  const data = await net.json(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`).catch(() => null);
  if (data && data.title) {
    return { caption: data.title, author: data.author_unique_id || data.author_name || '', image: data.thumbnail_url || '' };
  }
  // Fallback: the data TikTok embeds in its own page.
  const html = await net.text(url);
  const blob = scriptJsonById(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__');
  const item = blob && blob.__DEFAULT_SCOPE__ && blob.__DEFAULT_SCOPE__['webapp.video-detail'] &&
    blob.__DEFAULT_SCOPE__['webapp.video-detail'].itemInfo && blob.__DEFAULT_SCOPE__['webapp.video-detail'].itemInfo.itemStruct;
  if (item && item.desc) {
    return { caption: item.desc, author: (item.author && item.author.uniqueId) || '', image: (item.video && item.video.cover) || '' };
  }
  return { caption: metaContent(html, 'og:description') || metaContent(html, 'description'), image: metaContent(html, 'og:image') };
}

/** Caption text from Instagram's embed page (the one embedded posts load). */
function instagramEmbedCaption(html) {
  const start = html.search(/<div[^>]+class=["'][^"']*\bCaption\b[^"']*["']/i);
  if (start === -1) return null;
  let chunk = html.slice(start);
  const end = chunk.search(/<div[^>]+class=["'][^"']*\bCaptionComments\b/i);
  if (end > 0) chunk = chunk.slice(0, end);
  const author = ((chunk.match(/class=["'][^"']*CaptionUsername[^"']*["'][^>]*>([^<]+)</i) || [])[1] || '').trim();
  chunk = chunk.replace(/<a[^>]+class=["'][^"']*CaptionUsername[^"']*["'][^>]*>[\s\S]*?<\/a>/i, '');
  return { caption: htmlToText(chunk), author };
}

/** og:description on Instagram looks like: 1,234 likes, 56 comments - user on May 1, 2026: "caption". */
function instagramMetaCaption(html) {
  const d = metaContent(html, 'og:description') || metaContent(html, 'description');
  const m = d.match(/^[\s\S]*?\bon [A-Z][a-z]+ \d{1,2}, \d{4}:\s*["“]?([\s\S]*?)["”]?\.?\s*$/);
  if (m) return m[1];
  const t = metaContent(html, 'og:title').match(/on Instagram:\s*["“]([\s\S]*)["”]\s*$/);
  return t ? t[1] : '';
}

async function fromInstagram(src, net) {
  const embed = await net.text(`https://www.instagram.com/p/${src.code}/embed/captioned/`).catch(() => '');
  const fromEmbed = embed ? instagramEmbedCaption(embed) : null;
  const img = (embed.match(/class=["'][^"']*EmbeddedMediaImage[^"']*["'][^>]*src=["']([^"']+)["']/i) || [])[1];
  if (fromEmbed && fromEmbed.caption) {
    return { caption: fromEmbed.caption, author: fromEmbed.author, image: img ? decodeEntities(img) : '' };
  }
  const page = await net.text(src.url).catch(() => '');
  return { caption: instagramMetaCaption(page), image: metaContent(page, 'og:image') };
}

async function fromArticle(url, net) {
  const html = await net.text(url);
  const node = jsonLdRecipe(html);
  if (node) {
    const r = recipeFromJsonLd(node);
    if (r.ingredients.length) return { recipe: { ...r, image: r.image || metaContent(html, 'og:image') }, via: 'recipe data' };
  }
  const h1 = (html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  const body = (html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i) || [])[1] || html;
  const text = `${h1 ? plain(h1) : metaContent(html, 'og:title')}\n${htmlToText(body)}`;
  const r = parseRecipe(text);
  return { recipe: r && { ...r, image: metaContent(html, 'og:image') }, via: 'page text' };
}

/* ---------------- main entry ---------------- */

/**
 * The user-facing messages for the use case's alternate flows (requirements spec, section 8).
 * `code` lets the app and the tests tell them apart without matching on wording.
 */
const MESSAGES = {
  'invalid-link': 'Enter a full link starting with http',              // 2a
  unreachable: 'Couldn\'t reach that page',                             // 3a
  'no-recipe': 'No recipe found on that page',                          // 4a
};

class ImportError extends Error {
  constructor(message, extra = {}) { super(message); Object.assign(this, extra); }
}

/**
 * Import a recipe from a link. `net` supplies { text(url, opts), json(url), resolve(url) }.
 * Resolves to { recipe, platform, via } or throws ImportError with a user-facing message.
 */
async function importFromUrl(rawUrl, net, env = {}) {
  const src = detectSource(rawUrl);
  if (!src) throw new ImportError(MESSAGES['invalid-link'], { code: 'invalid-link' });

  if (src.platform === 'article') {
    let res;
    try { res = await fromArticle(src.url, net); } catch (e) {
      throw new ImportError(`${MESSAGES.unreachable} (${e.message}). Some sites block apps from reading them — copy the page text into Import → Text instead.`, { code: 'unreachable' });
    }
    if (!res.recipe || !res.recipe.ingredients.length) {
      throw new ImportError(MESSAGES['no-recipe'], { code: 'no-recipe' });
    }
    return { platform: 'article', via: res.via, recipe: { ...res.recipe, source: src.url } };
  }

  let video;
  try {
    if (src.platform === 'youtube') video = await fromYouTube(src, net, env);
    else if (src.platform === 'tiktok') video = await fromTikTok(src, net);
    else video = await fromInstagram(src, net);
  } catch (e) {
    throw new ImportError(`${MESSAGES.unreachable} — ${PLATFORM_NAMES[src.platform]} didn't answer (${e.message}).`, { code: 'unreachable' });
  }

  const caption = (video && video.caption || '').trim();
  if (!caption) {
    throw new ImportError(src.platform === 'instagram'
      ? `${MESSAGES['no-recipe']} — Instagram didn't share this post's caption (it often hides it from apps, and private accounts can't be read). Open the post, copy the caption and paste it into Import → Text.`
      : `${MESSAGES['no-recipe']} — couldn't read the description of that ${PLATFORM_NAMES[src.platform]} video.`, { code: 'no-recipe' });
  }

  const platformName = PLATFORM_NAMES[src.platform];
  let recipe = recipeFromCaption(caption, { title: video.title, author: video.author });
  let via = `${platformName} ${src.platform === 'youtube' ? 'description' : 'caption'}`;

  // Not enough in the caption? Many creators link to the full written recipe instead.
  if (!recipe || recipe.ingredients.length < 2) {
    for (const link of recipeLinks(caption).slice(0, 2)) {
      try {
        const res = await fromArticle(link, net);
        if (res.recipe && res.recipe.ingredients.length >= 2) {
          recipe = { ...res.recipe, image: res.recipe.image || video.image, linked: link };
          via = `recipe linked in the ${platformName} ${src.platform === 'youtube' ? 'description' : 'caption'}`;
          break;
        }
      } catch (e) { /* try the next link */ }
    }
  }

  if (!recipe || !recipe.ingredients.length) {
    throw new ImportError(`${MESSAGES['no-recipe']} — the ${platformName} ${src.platform === 'youtube' ? 'description' : 'caption'} has no ingredient list in it.`, { caption, code: 'no-recipe' });
  }

  const credit = [`Imported from ${platformName}${video.author ? ` · @${video.author.replace(/^@/, '')}` : ''}`,
    recipe.linked ? `Full recipe: ${recipe.linked}` : ''].filter(Boolean).join('\n');
  return {
    platform: src.platform,
    via,
    recipe: {
      name: recipe.name,
      description: [recipe.description, credit].filter(Boolean).join('\n\n'),
      ingredients: recipe.ingredients,
      amounts: recipe.amounts,
      directions: recipe.directions,
      time: recipe.time || '',
      image: recipe.image || video.image || '',
      source: src.url,
    },
  };
}

module.exports = {
  importFromUrl, ImportError, MESSAGES, detectSource, htmlToText, jsonLdRecipe, recipeFromJsonLd,
  instagramEmbedCaption, instagramMetaCaption, cleanCaption, recipeLinks, cleanVideoTitle, isoDuration,
};
