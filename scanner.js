/* Cookbook App — reading recipes out of files
 *
 * Design doc "Big Features → Photo: scan photos for recipe text and save relevant data", and the
 * Import window's PDF option.
 *
 *   PDF  — the text inside the PDF is read with pdf.js (Mozilla, Apache-2.0, in vendor/pdfjs — runs in the
 *          browser, nothing is uploaded). The lines are put back in reading order (two-column recipe
 *          cards, wrapped directions, repeated page headers), then scanned by parser.js like pasted text.
 *          A cookbook PDF with several recipes lists them so the cook can pick one.
 *
 * The functions that decide what the text says (buildPageLines, joinPages, findRecipePages, readPdfText)
 * take plain data or a pdf.js object, so the tests run them in Node on real PDF files.
 */
(function (root) {
  'use strict';

  const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();

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

  /** A PDF File → { pages, pageTexts, recipes: [{ from, to }], numPages, readPages, doc }. */
  async function readPdf(file, progress) {
    const lib = await getPdfjs();
    const result = await readPdfText(lib, new Uint8Array(await file.arrayBuffer()), { progress });
    const pageTexts = result.pages.map((p, i) => joinPages(result.pages, i, i));
    return { ...result, pageTexts, recipes: findRecipePages(pageTexts) };
  }

  const api = { buildPageLines, joinPages, findRecipePages, readPdfText, readPdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Scanner = api;
})(typeof window !== 'undefined' ? window : globalThis);
