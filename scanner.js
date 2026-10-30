/* Cookbook App — reading recipes out of files
 *
 * Design doc "Big Features → Photo: scan photos for recipe text and save relevant data", and the
 * Import window's PDF option.
 *
 *   PDF  — the text inside the PDF is read with pdf.js (Mozilla, Apache-2.0, in vendor/pdfjs — runs in the
 *          browser, nothing is uploaded). The lines are put back in reading order (two-column recipe
 *          cards, wrapped directions, repeated page headers), then scanned by parser.js like pasted text.
 *          A cookbook PDF with several recipes lists them so the cook can pick one. A scanned PDF (pictures of
 *          pages, no text inside) is read like a photo.
 *   Photo — a photo of a cookbook page or a screenshot is read with Tesseract OCR (Tesseract.js, Apache-2.0, in
 *          vendor/tesseract — runs in the browser, nothing is uploaded, no AI service). The photo is cropped to the
 *          box the cook draws and turned into clean black-on-white text, and lines that bend (a page curving into
 *          the spine, a photo taken at an angle) are flattened; typical OCR misreads are tidied, then parser.js
 *          reads it like pasted text.
 *   Fridge — design doc "let users add photos of their fridge to be scanned and update ingredients". Reading food
 *          (not text) needs an image AI, so it is optional: with the cook's own Gemini API key (as in Jayant's
 *          importer) the photo goes to Google, which lists what it sees. Without one, the cook ticks what they see
 *          from suggestions. Either way nothing changes until the cook confirms.
 *
 * The functions that decide what the text says (buildPageLines, joinPages, findRecipePages, readPdfText,
 * cleanOcrText) take plain data or a pdf.js object, so the tests run them in Node on real files.
 */
(function (root) {
  'use strict';

  const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();
  const Names = () => (typeof module !== 'undefined' && module.exports ? require('./names.js') : root.IngredientNames);

  /* ---------------- PDF text → lines in reading order ---------------- */

  /**
   * pdf.js gives a page's text as pieces with positions. Rebuild the lines a person reads:
   *   - pieces on the same baseline join into a row; pieces of one word ("a" "b" "out") join without a space
   *   - a wide gap splits a row into separate segments (a two-column card, "Prep 5 min      Cook 10 min")
   *   - where several rows in a row have a left and a right column, the left column is read first
   *   - a line that runs to the right edge of its column continues on the next line ("…cumin and garlic" +
   *     "powder.") and is joined back together, unless the next line starts a new item
   *   - a large vertical gap becomes a blank line (a new paragraph)
   *
   * items: [{ str, x, y, w, h }] (y grows upwards, as in PDF). Returns [{ text, y, h, x0, x1 }].
   */
  function buildPageLines(items, pageWidth) {
    const pieces = items
      .map((it) => ({ ...it, str: String(it.str || '').replace(/[\uE000-\uF8FF]/g, '') }))   // unmapped font glyphs
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({ str: it.str, x: it.x, y: it.y, w: Math.max(0, it.w), h: Math.max(1, it.h || 10) }))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    // 1. Rows: pieces whose baselines are within ~40% of the text height.
    const rows = [];
    pieces.forEach((p) => {
      const row = rows.find((r) => Math.abs(r.y - p.y) <= Math.max(2, 0.4 * Math.min(r.h, p.h)));
      if (row) { row.pieces.push(p); row.h = Math.max(row.h, p.h); } else rows.push({ y: p.y, h: p.h, pieces: [p] });
    });
    rows.sort((a, b) => b.y - a.y);

    // 2. Segments: split a row where the gap is wider than two characters' height.
    rows.forEach((row) => {
      row.pieces.sort((a, b) => a.x - b.x);
      row.segs = [];
      let seg = null;
      row.pieces.forEach((p) => {
        const gap = seg ? p.x - seg.x1 : Infinity;
        if (!seg || gap > Math.max(12, 2 * row.h)) {
          seg = { text: p.str.trim(), x0: p.x, x1: p.x + p.w, y: row.y, h: row.h };
          row.segs.push(seg);
          return;
        }
        const glue = gap > 0.15 * p.h && !/\s$/.test(seg.text) && !/^\s/.test(p.str) ? ' ' : '';
        seg.text = (seg.text + glue + p.str).replace(/\s+/g, ' ');
        seg.x1 = Math.max(seg.x1, p.x + p.w);
      });
      row.segs.forEach((s) => { s.text = s.text.trim(); });
    });

    // 3. Two-column regions: a gutter that many rows have text on both sides of, and no row crosses.
    const splitRows = rows.filter((r) => r.segs.length === 2 && r.segs[1].x0 > pageWidth * 0.25);
    const gutters = {};
    splitRows.forEach((r) => {
      const g = Math.round(r.segs[1].x0 / 10) * 10;
      gutters[g] = (gutters[g] || 0) + 1;
    });
    const best = Object.entries(gutters).sort((a, b) => b[1] - a[1])[0];
    const regions = [];   // [startRowIndex, endRowIndex, gutterX]
    if (best && best[1] >= 3) {
      const g = Number(best[0]) - 5;
      const crosses = (r) => r.segs.some((s) => s.x0 < g - 2 && s.x1 > g + 2);
      const isSplit = (r) => r.segs.some((s) => s.x0 < g) && r.segs.some((s) => s.x0 >= g);
      let i = 0;
      while (i < rows.length) {
        if (crosses(rows[i])) { i++; continue; }
        let j = i;
        while (j + 1 < rows.length && !crosses(rows[j + 1])) j++;
        const splits = rows.slice(i, j + 1).filter(isSplit).length;
        if (splits >= 3) regions.push([i, j, g]);
        i = j + 1;
      }
    }

    // 4. Lines in reading order.
    const lines = [];
    for (let i = 0; i < rows.length; i++) {
      const region = regions.find(([a]) => a === i);
      if (region) {
        const [a, b, g] = region;
        const block = rows.slice(a, b + 1);
        const left = []; const right = [];
        block.forEach((r) => r.segs.forEach((s) => (s.x0 < g ? left : right).push(s)));
        lines.push(...left, ...right);
        i = b;
      } else {
        lines.push(...rows[i].segs);
      }
    }

    // 5. Join wrapped lines; mark paragraph gaps.
    const out = [];
    const rightEdge = (seg) => {
      // The right edge of the column this line sits in: the furthest any line starting near it reaches.
      let edge = 0;
      lines.forEach((l) => { if (Math.abs(l.x0 - seg.x0) < pageWidth * 0.2) edge = Math.max(edge, l.x1); });
      return edge;
    };
    const NEW_ITEM = /^(\d+[.)]|step\s*\d|[•·▪◦*\-–—]|\d|[½⅓⅔¼¾⅛]|ingredients?\b|directions?\b|instructions?\b|method\b|notes?\b)/i;
    lines.forEach((seg) => {
      const prev = out[out.length - 1];
      if (prev && !prev.blank) {
        const gap = prev.y - seg.y;
        const sameColumn = Math.abs(seg.x0 - prev.x0) < Math.max(30, 4 * seg.h) && gap > 0;
        const wrapped = prev.x1 >= rightEdge(prev) - Math.max(2.5 * seg.h, 24);
        const lineGap = gap > 0 && gap <= 1.6 * Math.max(prev.h, seg.h);
        const sameSize = Math.abs(prev.h - seg.h) <= 0.2 * Math.max(prev.h, seg.h);   // a title never runs on into its subtitle
        if (sameColumn && sameSize && wrapped && lineGap && !NEW_ITEM.test(seg.text) && !/[:]$/.test(prev.text)) {
          prev.text = /-$/.test(prev.text) && /^[a-z]/.test(seg.text)
            ? prev.text.slice(0, -1) + seg.text
            : `${prev.text} ${seg.text}`;
          prev.x1 = seg.x1;
          prev.y = seg.y;
          return;
        }
        if (gap > 2 * Math.max(prev.h, seg.h) || gap < 0) out.push({ blank: true, text: '', y: seg.y, h: seg.h, x0: 0, x1: 0 });
      }
      // "Notes: brown the butter slowly" → a Notes heading the recipe scanner recognises, then the note.
      const note = /^((?:recipe |cook(?:'|’)?s |chef(?:'|’)?s )?notes?)\s*:\s+(\S.*)$/i.exec(seg.text);
      if (note) {
        out.push({ ...seg, text: `${note[1]}:` }, { ...seg, text: note[2] });
        return;
      }
      out.push({ ...seg });
    });
    return out;
  }

  /** In the page margin: the top or bottom 8% of the page, where headers and footers are printed. */
  const inMargin = (page, l) => !page.height || l.y > page.height * 0.92 || l.y < page.height * 0.08;

  /** Lines that repeat in the top or bottom margin of most pages (site name, "Page 2 of 3", a printed URL). */
  function repeatedEdgeLines(pages) {
    if (pages.length < 2) return new Set();
    const key = (t) => norm(t).replace(/\d+/g, '#');
    const counts = {};
    pages.forEach((p) => {
      const edge = new Set();
      const real = p.lines.filter((l) => !l.blank);
      real.slice(0, 2).concat(real.slice(-2)).filter((l) => inMargin(p, l)).forEach((l) => edge.add(key(l.text)));
      edge.forEach((k) => { counts[k] = (counts[k] || 0) + 1; });
    });
    return new Set(Object.keys(counts).filter((k) => counts[k] >= Math.max(2, Math.ceil(pages.length * 0.6))));
  }

  /** What a browser stamps on a printed page: "10/30/26, 2:21 PM", "1/3", "Page 2 of 5", a URL. */
  const PRINT_STAMP = /^(\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}\s*:?\s*\d{2}\s*([ap]\.?m\.?)?|(page\s*)?\d+\s*(\/|of)\s*\d+|(https?:\/\/|www\.|about:blank|file:\/\/)\S*)$/i;

  /** Text of some pages, page headers and footers left out. pages: [{ lines }] from buildPageLines. */
  function joinPages(pages, from = 0, to = pages.length - 1) {
    const drop = repeatedEdgeLines(pages);
    const key = (t) => norm(t).replace(/\d+/g, '#');
    const text = [];
    for (let i = from; i <= to && i < pages.length; i++) {
      const real = pages[i].lines;
      real.forEach((l, j) => {
        const nearEdge = (j < 3 || j >= real.length - 3) && inMargin(pages[i], l);
        if (!l.blank && nearEdge && (drop.has(key(l.text)) || PRINT_STAMP.test(l.text.trim()))) return;
        text.push(l.text);
      });
      text.push('');
    }
    return text.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  const ING_HEAD = /^\s*(ingredients?( list)?|what you(?:'|’)?ll need|you(?:'|’)?ll need|you will need)\s*:?\s*$/im;

  /**
   * Pages where a recipe starts (they have an "Ingredients" heading). A cookbook PDF gives several;
   * each recipe runs until the next one starts (at most 2 pages).
   * Returns [{ from, to }] as page indexes.
   */
  function findRecipePages(pageTexts) {
    const starts = [];
    pageTexts.forEach((t, i) => { if (ING_HEAD.test(t)) starts.push(i); });
    return starts.map((s, k) => ({ from: s, to: Math.min(s + 1, (k + 1 < starts.length ? starts[k + 1] - 1 : pageTexts.length - 1)) }));
  }

  /**
   * Read a PDF with pdf.js (`lib` = the loaded pdf.js module) and return every page's lines.
   *   data: Uint8Array. maxPages: stop after this many. progress(fraction).
   * Throws Error with .code = 'password' | 'unreadable'.
   */
  async function readPdfText(lib, data, { maxPages = 150, progress } = {}) {
    let doc;
    try {
      doc = await lib.getDocument({ data, verbosity: 0, isEvalSupported: false }).promise;
    } catch (e) {
      const err = new Error(e && e.name === 'PasswordException' ? 'password' : 'unreadable');
      err.code = err.message;
      throw err;
    }
    const n = Math.min(doc.numPages, maxPages);
    const pages = [];
    for (let p = 1; p <= n; p++) {
      const page = await doc.getPage(p);
      const { width, height } = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items.filter((it) => 'str' in it)
        .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]) }));
      pages.push({ lines: buildPageLines(items, width), width, height });
      if (progress) progress(p / n);
    }
    return { doc, pages, numPages: doc.numPages, readPages: n };
  }

  /* ---------------- OCR text clean-up ---------------- */

  function editDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[a.length][b.length];
  }

  const OCR_HEADINGS = ['Ingredients', 'Directions', 'Instructions', 'Method', 'Notes'];

  /**
   * Tidy text read by OCR before the recipe scanner sees it:
   *   - misread headings: "Ingrediants:", "pirections:", "Directlons" → "Ingredients:" / "Directions:"
   *   - step numbers read as "2," or "3;" → "2.", amounts glued to words ("1egg") or misread ("Tegg", "2 ibs")
   *   - scraps read off pictures and app buttons (no real word in them; "Description", "Show more")
   */
  function cleanOcrText(text) {
    return String(text || '')
      .replace(/\r/g, '')
      .replace(/[‘’]/g, '’')
      .split('\n')
      .map((raw) => {
        let line = raw.replace(/[ \t]+/g, ' ').trim()
          .replace(/^(\d+)\s*[|Il1]bs\b/, '$1 lbs')                                         // "2 |bs" → "2 lbs"
          // A fraction OCR couldn't read ("v4 c", "% t") → "? c", so the amount shows what to check.
          .replace(/^(?![\d/.]+\s)(?=\S*[%4¥])\S{1,3}\s+(?=(?:c|¢|t|tsp|tbsp|tbs|cups?|oz|lbs?|g|ml)(?=\s|$))/, '? ');
        line = line.replace(/[|¦_~=«»{}\[\]]+/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*[\\/]+$/, '').trim();
        line = line.replace(/^[^\w½⅓⅔¼¾⅛"“(•?-]+/, '').trim();                  // leading junk: "— ", "‘ ", ". "
        if (!line) return raw.trim() ? null : '';   // a line that was only junk goes; a real blank line stays
        const bare = line.replace(/[^A-Za-z]/g, '').toLowerCase();
        if (bare.length >= 4 && bare.length <= 14 && line.length <= 20) {
          const hit = OCR_HEADINGS.find((h) => editDistance(bare, h.toLowerCase()) <= (h.length > 6 ? 2 : 1));
          if (hit) return `${hit}:`;
        }
        if (!/[A-Za-z]{3,}/.test(line)) return /^\d/.test(line) && /[A-Za-z]/.test(line) ? line : null;   // "1 egg" stays
        if (line.replace(/[^A-Za-z0-9 ,.'’()/½⅓⅔¼¾⅛°-]/g, '').length < line.length * 0.75) return null;      // mostly symbols
        if (/^(description|transcript|show (more|less)|more|less|comments?|reply|share|save|follow|subscribe)\s*:?$/i.test(line)) return null;
        line = line.replace(/^(\d{1,2})\s*[,;:]\s+(?=[A-Za-z])/, '$1. ');                // "2, In a bowl" → "2. In a bowl"
        line = line.replace(/^(\d+)\s*ibs\b/i, '$1 lbs');                                 // "2 ibs" → "2 lbs"
        line = line.replace(/^[Tl|I](?=(eggs?|cups?|tsp|tbsp|tbs|lbs?|oz|cloves?)\b)/, '1 ');  // "Tegg" → "1 egg"
        line = line.replace(/^(\d+(?:\/\d+)?)(?=[a-z]{2,})/i, '$1 ');                      // "1egg" → "1 egg"
        line = line.replace(/(^|\s)¢(?=\s)/g, '$1c');                                      // "¢" read for "c" (cup)
        line = line.replace(/\b(oll|Qil|0il)\b/g, (m) => (m[0] === 'o' ? 'oil' : 'Oil'));        // "olive oll", "Qil"
        return line;
      })
      .filter((l) => l !== null)
      .filter((l, i, all) => l || (i > 0 && all[i - 1]))                                  // collapse blank runs
      .join('\n')
      .trim();
  }

  /**
   * Text read from a photo or a scanned page → a recipe (parser.js), with OCR clean-up first. An amount OCR
   * couldn't read stays visible as "?" ("? c" extra-virgin olive oil) for the cook to fix in the review form.
   */
  function parseScannedText(text) {
    const Parser = typeof module !== 'undefined' && module.exports ? require('./parser.js') : root.RecipeParser;
    const r = Parser.parseRecipe(cleanOcrText(text));
    if (!r) return r;
    r.name = r.name.replace(/^\p{Ll}/u, (c) => c.toUpperCase());   // OCR often reads a title's capital C, S, O as small
    r.ingredients = r.ingredients.map((raw) => {
      const name = raw.replace(/^["“‘'`]+\s*/, '').replace(/^\p{Ll}/u, (c) => c.toUpperCase());
      if (name !== raw && r.amounts[norm(raw)] !== undefined) { r.amounts[norm(name)] = r.amounts[norm(raw)]; delete r.amounts[norm(raw)]; }
      const m = /^\?\s+(c|t|tsp|tbsp|tbs|cups?|oz|lbs?|g|ml)\s+(.+)$/i.exec(name);
      if (!m) return name;
      const clean = m[2].replace(/,\s*as needed$/i, '').trim();
      const { name: fixed, note } = Names().shorten(clean.charAt(0).toUpperCase() + clean.slice(1));
      delete r.amounts[norm(name)];
      r.amounts[norm(fixed)] = Names().withNote(`? ${m[1]}`, note);
      return fixed;
    });
    return r;
  }

  /* ---------------- fridge photos ---------------- */

  /** Matching key: lower case, plain letters, simple plurals dropped ("Large Brown Eggs" → "large brown egg"). */
  const itemKey = (s) => norm(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').map((w) => (w.length > 3 ? w.replace(/(es|s)$/, '') : w)).join(' ');

  const titleCase = (s) => String(s).trim().replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase());

  /**
   * Put names found in a photo onto the names the cook already uses, so they light up recipes:
   * "Large brown eggs" → "Eggs", "Shredded Mozzarella" → "Mozzarella", "romaine" → "Romaine lettuce".
   * Unknown items keep their own name. Returns [{ name, found }], no duplicates.
   */
  function matchToKnown(found, known) {
    const knownKeys = known.map((k) => ({ name: k, key: itemKey(k) })).filter((k) => k.key)
      .sort((a, b) => b.key.length - a.key.length);   // the most specific name first
    const out = [];
    found.forEach((said) => {
      const raw = Names().shorten(said).name;   // "Shredded mozzarella" → Mozzarella, like every import
      const k = itemKey(raw);
      if (!k) return;
      const hit = knownKeys.find((x) => x.key === k)
        || knownKeys.find((x) => (` ${k} `).includes(` ${x.key} `))                      // "large brown egg" has "egg"
        || knownKeys.find((x) => k.length >= 4 && (` ${x.key} `).includes(` ${k} `));     // "romaine" → "romaine lettuce"
      const name = hit ? hit.name : titleCase(raw);
      if (!out.some((o) => norm(o.name) === norm(name))) out.push({ name, found: String(said).trim() });
    });
    return out;
  }

  const STAPLES = ['Milk', 'Eggs', 'Butter', 'Cheese', 'Cream cheese', 'Sour cream', 'Yogurt', 'Bread', 'Lettuce',
    'Tomatoes', 'Onions', 'Carrots', 'Bell peppers', 'Spinach', 'Chicken', 'Ground beef', 'Bacon', 'Ham',
    'Orange juice', 'Apples', 'Lemons', 'Ketchup', 'Mustard', 'Mayonnaise'];

  /**
   * What to offer as tick boxes beside a fridge photo: what the shopping lists still need first (that's what
   * was just bought), then what the recipes use, then common fridge staples. Nothing already in the fridge.
   */
  function fridgeSuggestions(recipes, lists, fridge) {
    const seen = new Set(fridge.map(itemKey));
    const out = [];
    const add = (n) => { const k = itemKey(n); if (k && !seen.has(k)) { seen.add(k); out.push(n); } };
    lists.forEach((l) => l.items.filter((i) => !i.done).forEach((i) => add(i.name)));
    recipes.forEach((r) => (r.ingredients || []).forEach(add));
    STAPLES.forEach(add);
    return out;
  }

  const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-2.5-flash'];
  const FRIDGE_PROMPT = 'This is a photo of the inside of a home refrigerator. List every food or drink you can identify, '
    + 'as short generic grocery names a recipe would use (for example "Eggs", "Mozzarella", "Sour cream", '
    + '"Romaine lettuce", "Cream cheese"). Read the package labels to decide. Leave out shelves, empty containers, '
    + 'anything you cannot identify and anything that is not food. Answer with a JSON array of strings only.';

  /**
   * Ask Gemini what food is in a photo (a base64 data URL). Returns an array of names, at most 40.
   * Errors carry a message for the cook and .code: 'key' | 'quota' | 'network' | 'answer' | 'unavailable'.
   * fetchFn is injectable for the tests.
   */
  async function geminiFridgeItems(dataUrl, apiKey, fetchFn = (typeof fetch !== 'undefined' ? fetch : null)) {
    const fail = (code, message) => Object.assign(new Error(message), { code });
    const m = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl || '');
    if (!m) throw fail('answer', 'Couldn\'t read that photo.');
    if (!String(apiKey || '').trim()) throw fail('key', 'Add your Gemini API key first.');
    const body = JSON.stringify({
      contents: [{ parts: [{ text: FRIDGE_PROMPT }, { inline_data: { mime_type: m[1], data: m[2] } }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: { type: 'ARRAY', items: { type: 'STRING' } } },
    });
    let last = fail('unavailable', 'Gemini isn\'t available right now — tick what you see instead.');
    for (const model of GEMINI_MODELS) {
      let res;
      try {
        res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
          body,
          signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(45000) : undefined,
        });
      } catch (e) {
        throw fail('network', 'Couldn\'t reach Gemini — check the internet connection, or tick what you see instead.');
      }
      let json = {};
      try { json = await res.json(); } catch (e) { /* no body */ }
      const msg = String((json.error && json.error.message) || '');
      if (res.status === 404) continue;                                    // that model isn't offered: try the next
      if (res.status === 401 || res.status === 403 || /api key/i.test(msg)) {
        throw fail('key', 'Gemini didn\'t accept that API key. Check it, or tick what you see instead.');
      }
      if (res.status === 429) throw fail('quota', 'Gemini says the free limit is used up for now — tick what you see instead.');
      if (!res.ok) { last = fail('unavailable', `Gemini couldn't look at the photo (error ${res.status}) — tick what you see instead.`); continue; }
      const text = (((json.candidates || [])[0] || {}).content || { parts: [] }).parts.map((p) => p.text || '').join('');
      let items;
      try { items = JSON.parse(text); } catch (e) { items = null; }
      if (!Array.isArray(items)) throw fail('answer', 'Gemini\'s answer couldn\'t be read — tick what you see instead.');
      return items.map((x) => String(x).trim()).filter(Boolean).slice(0, 40);
    }
    throw last;
  }

  /* ---------------- browser only ---------------- */

  const inBrowser = typeof document !== 'undefined';
  const abs = (p) => new URL(p, inBrowser ? document.baseURI : 'http://localhost/').href;

  let pdfjsPromise = null;
  function getPdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = import(abs('vendor/pdfjs/pdf.min.mjs')).then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = abs('vendor/pdfjs/pdf.worker.min.mjs');
        return lib;
      });
      pdfjsPromise.catch(() => { pdfjsPromise = null; });
    }
    return pdfjsPromise;
  }

  /* ---- OCR (Tesseract.js) ---- */

  const scripts = {};
  function loadScript(src) {
    if (!scripts[src]) {
      scripts[src] = new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;
        el.onload = resolve;
        el.onerror = () => { delete scripts[src]; reject(new Error(`Couldn't load ${src}`)); };
        document.head.appendChild(el);
      });
    }
    return scripts[src];
  }

  let workerPromise = null;
  let onOcrProgress = null;
  function getWorker() {
    if (!workerPromise) {
      workerPromise = (async () => {
        await loadScript(abs('vendor/tesseract/tesseract.min.js'));
        return root.Tesseract.createWorker('eng', 1, {   // 1 = the LSTM (neural) recogniser only
          workerPath: abs('vendor/tesseract/worker.min.js'),
          corePath: abs('vendor/tesseract/'),
          langPath: abs('vendor/tesseract/lang'),
          gzip: true,
          logger: (m) => { if (onOcrProgress) onOcrProgress(m); },
        });
      })();
      workerPromise.catch(() => { workerPromise = null; });
    }
    return workerPromise;
  }

  /** Start the OCR engine in the background (a few seconds the first time) so the scan itself is quicker. */
  function preloadOcr() { getWorker().catch(() => {}); }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('unreadable'));
      img.src = src;
    });
  }

  /** Greyscale (light-on-dark screenshots flipped to dark-on-light), then black or white against the local average. */
  function binarize(ctx, w, h, { win = 30, C = 10 } = {}) {
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    const g = new Float32Array(w * h);
    let total = 0;
    for (let i = 0; i < w * h; i++) {
      g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
      total += g[i];
    }
    if (total / (w * h) < 110) for (let i = 0; i < w * h; i++) g[i] = 255 - g[i];

    const integral = new Float64Array((w + 1) * (h + 1));
    for (let y = 1; y <= h; y++) {
      let row = 0;
      for (let x = 1; x <= w; x++) {
        row += g[(y - 1) * w + (x - 1)];
        integral[y * (w + 1) + x] = integral[(y - 1) * (w + 1) + x] + row;
      }
    }
    const r = Math.max(6, Math.round(w / win));
    const mean = (x, y, rad) => {
      const x0 = Math.max(0, x - rad); const x1 = Math.min(w, x + rad + 1);
      const y0 = Math.max(0, y - rad); const y1 = Math.min(h, y + rad + 1);
      return (integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0])
        / ((x1 - x0) * (y1 - y0));
    };
    const ink = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) ink[y * w + x] = g[y * w + x] < mean(x, y, r) - C ? 1 : 0;
    }
    // Off the page (a carpet, a tablecloth, the edge of a shadow) turns into dense speckle; even bold text
    // covers well under a third of any wide area. Blanking the speckle keeps it from being read as a column
    // of junk beside the recipe.
    const R2 = Math.max(r * 2, Math.round(Math.max(w, h) / 14));
    const inkSum = new Float64Array((w + 1) * (h + 1));
    for (let y = 1; y <= h; y++) {
      let row = 0;
      for (let x = 1; x <= w; x++) {
        row += ink[(y - 1) * w + (x - 1)];
        inkSum[y * (w + 1) + x] = inkSum[(y - 1) * (w + 1) + x] + row;
      }
    }
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - R2); const y1 = Math.min(h, y + R2 + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - R2); const x1 = Math.min(w, x + R2 + 1);
        const density = (inkSum[y1 * (w + 1) + x1] - inkSum[y0 * (w + 1) + x1] - inkSum[y1 * (w + 1) + x0] + inkSum[y0 * (w + 1) + x0])
          / ((x1 - x0) * (y1 - y0));
        if (density > 0.3) ink[y * w + x] = 0;
        const o = (y * w + x) * 4;
        px[o] = px[o + 1] = px[o + 2] = ink[y * w + x] ? 0 : 255;
        px[o + 3] = 255;
      }
    }
    ctx.putImageData(data, 0, 0);
    return ink;
  }

  /** The crop box of a photo, turned `angle` degrees around the box's centre, drawn `width` px wide. */
  function drawCrop(img, crop, angle, width) {
    const W = img.naturalWidth || img.width;
    const H = img.naturalHeight || img.height;
    const sw = Math.max(8, crop.w * W); const sh = Math.max(8, crop.h * H);
    const scale = Math.max(0.2, Math.min(3, width / sw));
    const out = document.createElement('canvas');
    out.width = Math.round(sw * scale); out.height = Math.round(sh * scale);
    const ctx = out.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.translate(out.width / 2, out.height / 2);
    ctx.scale(scale, scale);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.drawImage(img, -(crop.x * W + sw / 2), -(crop.y * H + sh / 2));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return { canvas: out, ctx };
  }

  /** Least-squares fit of v(t) = c0 + c1·t + c2·t² through weighted points. Returns [c0, c1, c2] or null. */
  function fitQuadratic(pts) {
    const S = Array.from({ length: 3 }, () => new Float64Array(4));
    pts.forEach(({ t, v, wgt }) => {
      const b = [1, t, t * t];
      for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) S[i][j] += wgt * b[i] * b[j]; S[i][3] += wgt * b[i] * v; }
    });
    for (let i = 0; i < 3; i++) {   // Gauss–Jordan on the 3×4 system
      let piv = i;
      for (let r = i + 1; r < 3; r++) if (Math.abs(S[r][i]) > Math.abs(S[piv][i])) piv = r;
      [S[i], S[piv]] = [S[piv], S[i]];
      if (Math.abs(S[i][i]) < 1e-9) return null;
      for (let r = 0; r < 3; r++) {
        if (r === i) continue;
        const f = S[r][i] / S[i][i];
        for (let c = i; c < 4; c++) S[r][c] -= f * S[i][c];
      }
    }
    return [S[0][3] / S[0][0], S[1][3] / S[1][1], S[2][3] / S[2][2]];
  }

  /**
   * Straighten text lines that bend or squeeze together (a book page curving into the spine, a photo taken
   * at an angle): compare the rows of text in neighbouring narrow vertical strips to find how far they move
   * up or down and how much closer together they get, fit smooth curves through that across the page, and
   * redraw every column of pixels so the rows line up. Flat pages and screenshots measure nothing to fix and
   * are left alone. Returns true when the image was changed.
   */
  function dewarp(canvas, ink) {
    const { width: w, height: h } = canvas;
    const n = Math.max(4, Math.min(14, Math.round(w / 170)));
    const sw = w / n;
    const profiles = [];
    for (let k = 0; k < n; k++) {
      const p = new Float64Array(h);
      const x0 = Math.round(k * sw); const x1 = Math.round((k + 1) * sw);
      for (let y = 0; y < h; y++) {
        let c = 0;
        for (let x = x0; x < x1; x++) c += ink[y * w + x];
        p[y] = c;
      }
      const sm = new Float64Array(h);   // light smoothing so single pixels don't decide
      for (let y = 0; y < h; y++) sm[y] = (p[Math.max(0, y - 1)] + p[y] + p[Math.min(h - 1, y + 1)]) / 3;
      profiles.push({ p: sm, ink: sm.reduce((a, b) => a + b, 0), x: (x0 + x1) / 2 });
    }
    const enough = Math.max(...profiles.map((q) => q.ink)) * 0.15;
    const maxStep = Math.max(4, Math.round(h / 40));
    const mid = h / 2;
    const sample = (arr, y) => {   // linear interpolation, 0 outside
      if (y < 0 || y > h - 1) return 0;
      const i = Math.floor(y); const f = y - i;
      return arr[i] * (1 - f) + (i + 1 < h ? arr[i + 1] : 0) * f;
    };
    // Walk strip to strip. Each step finds the shift k and squeeze s that best line up this strip's rows with the
    // last one: y_here = s·(y_before − mid) + mid + k. Composed, that maps every strip back to the first one:
    // y_first = A·y + B.
    const pts = [];
    let prev = null; let A = 1; let B = 0;
    profiles.forEach((q) => {
      if (q.ink < enough) return;
      if (prev) {
        let best = { k: 0, s: 1 }; let bestScore = -Infinity;
        for (let s = 0.96; s <= 1.0401; s += 0.005) {
          for (let k = -maxStep; k <= maxStep; k++) {
            let sc = 0;
            for (let y = 0; y < h; y += 2) sc += prev.p[y] * sample(q.p, s * (y - mid) + mid + k);
            if (sc > bestScore) { bestScore = sc; best = { k, s }; }
          }
        }
        // y_before = (y_here − mid − k)/s + mid, then into the first strip's frame.
        B = A * (mid - (mid + best.k) / best.s) + B;
        A = A / best.s;
      }
      pts.push({ t: q.x / w, A, B, wgt: q.ink });
      prev = q;
    });
    if (pts.length < 3) return false;
    const fa = fitQuadratic(pts.map((p) => ({ t: p.t, v: p.A, wgt: p.wgt })));
    const fb = fitQuadratic(pts.map((p) => ({ t: p.t, v: p.B, wgt: p.wgt })));
    if (!fa || !fb) return false;
    const at = (f, x) => { const t = x / w; return f[0] + f[1] * t + f[2] * t * t; };

    // Where the middle row and the top and bottom of the image land, for each column: is there anything to fix?
    let lo = Infinity; let hi = -Infinity; let sLo = Infinity; let sHi = -Infinity;
    for (let x = 0; x < w; x += 8) {
      const a = at(fa, x); const b = at(fb, x);
      if (!(a > 0.7 && a < 1.4)) return false;    // the measurement went astray: leave the image as it is
      const m = a * mid + b; lo = Math.min(lo, m); hi = Math.max(hi, m); sLo = Math.min(sLo, a); sHi = Math.max(sHi, a);
    }
    if (hi - lo < 3 && (sHi - sLo) * h < 3) return false;
    if (hi - lo > h * 0.3) return false;

    // Redraw: output row y (in the first strip's frame, centred) comes from source row (y + offset − B)/A.
    const offset = (lo + hi) / 2 - mid;
    const copy = document.createElement('canvas');
    copy.width = w; copy.height = h;
    copy.getContext('2d').drawImage(canvas, 0, 0);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x++) {
      const a = at(fa, x); const b = at(fb, x);
      const srcTop = (0 + offset - b) / a;
      ctx.drawImage(copy, x, srcTop, 1, h / a, x, 0, 1, h);
    }
    return true;
  }

  /** Crop, straighten, clean up and flatten (part of) a photo for the text reader. */
  function prepareImage(img, crop, angle) {
    const { canvas, ctx } = drawCrop(img, crop, angle, 2000);
    const ink = binarize(ctx, canvas.width, canvas.height);
    dewarp(canvas, ink);
    return canvas;
  }

  /** OCR one prepared canvas. psm 4 = "a single column of text of different sizes" — a recipe card. */
  async function recognize(canvas, progress, psm = 4) {
    onOcrProgress = (m) => {
      if (!progress) return;
      if (m.status === 'recognizing text') progress(0.25 + 0.75 * m.progress, 'Reading the text…');
      else progress(0.05 + 0.2 * (m.progress || 0), 'Starting the text reader…');
    };
    try {
      const worker = await Promise.race([getWorker(), new Promise((_, reject) => setTimeout(() => reject(new Error('ocr-start')), 90000))]);
      await worker.setParameters({ tessedit_pageseg_mode: String(psm) });
      const { data } = await worker.recognize(canvas);
      return { text: cleanOcrText(data.text), raw: data.text, confidence: Math.round(data.confidence || 0) };
    } finally {
      onOcrProgress = null;
    }
  }

  /**
   * Read the text in a photo (a data or object URL).
   *   crop: { x, y, w, h } as fractions of the photo (default: all of it); angle: degrees to turn it.
   * Returns { text, confidence }.
   */
  async function ocrPhoto(src, { crop = { x: 0, y: 0, w: 1, h: 1 }, angle = 0 } = {}, progress) {
    return recognize(prepareImage(await loadImage(src), crop, angle), progress);
  }

  /** The black-and-white image the text reader is given (for checking what it sees). */
  async function ocrInput(src, { crop = { x: 0, y: 0, w: 1, h: 1 }, angle = 0 } = {}) {
    return prepareImage(await loadImage(src), crop, angle).toDataURL('image/png');
  }

  /** A scanned PDF: draw its pages (at most 3) and read them like photos. Returns the text. */
  async function ocrPdfPages(doc, from, to, progress) {
    const last = Math.min(to, from + 2, doc.numPages - 1);
    let text = '';
    for (let p = from; p <= last; p++) {
      const page = await doc.getPage(p + 1);
      const vp = page.getViewport({ scale: 1 });
      const scale = Math.min(4, 2000 / vp.width);
      const view = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(view.width); canvas.height = Math.round(view.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: view }).promise;
      binarize(ctx, canvas.width, canvas.height);
      const n = last - from + 1; const k = p - from;
      const { text: t } = await recognize(canvas, (f, msg) => progress && progress((k + f) / n, `Reading page ${p + 1}… ${msg}`));
      text += `${t}\n\n`;
    }
    return text.trim();
  }

  /* ---- Gemini key (kept only in this browser) ---- */

  const GEMINI_KEY_STORE = 'cookbook-gemini-key';
  function geminiKey() {
    try { return localStorage.getItem(GEMINI_KEY_STORE) || ''; } catch (e) { return ''; }
  }
  function setGeminiKey(k) {
    try {
      if (k) localStorage.setItem(GEMINI_KEY_STORE, k.trim()); else localStorage.removeItem(GEMINI_KEY_STORE);
    } catch (e) { /* storage blocked: the key just isn't remembered */ }
  }


  /** A PDF File → { pages, pageTexts, recipes: [{ from, to }], numPages, readPages, doc }. */
  async function readPdf(file, progress) {
    const lib = await getPdfjs();
    const result = await readPdfText(lib, new Uint8Array(await file.arrayBuffer()), { progress });
    const pageTexts = result.pages.map((p, i) => joinPages(result.pages, i, i));
    return { ...result, pageTexts, recipes: findRecipePages(pageTexts) };
  }

  const api = {
    buildPageLines, joinPages, findRecipePages, readPdfText, readPdf, cleanOcrText, parseScannedText,
    preloadOcr, ocrPhoto, ocrPdfPages, ocrInput,
    matchToKnown, fridgeSuggestions, geminiFridgeItems, geminiKey, setGeminiKey, GEMINI_MODELS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Scanner = api;
})(typeof window !== 'undefined' ? window : globalThis);
