/* Cookbook App — recipe text scanner
 *
 * Turns a recipe pasted from a web page (story, ads, buttons and all) into
 *   { name, description, ingredients: [names], amounts: {name: "2 cups"}, directions }
 *
 * Plain rule-based parsing, no AI. Works in the browser (window.RecipeParser)
 * and in Node (require('./parser.js')) so it can be tested from the command line.
 */
(function (root) {
  'use strict';

  /* ---------------- text helpers ---------------- */

  const norm = (s) => String(s).trim().toLowerCase();
  const words = (s) => s.split(/\s+/).filter(Boolean);
  const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const UNICODE_FRACTIONS = {
    '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅕': '1/5',
    '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6', '⅛': '1/8',
    '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
  };
  const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join('');

  /** "1½" → "1 1/2", "¾" → "3/4", "1⁄2" (fraction slash) → "1/2". */
  function asciiFractions(s) {
    return s
      .replace(/⁄/g, '/')
      .replace(new RegExp(`(\\d)\\s*([${FRACTION_CHARS}])`, 'g'), (m, d, f) => `${d} ${UNICODE_FRACTIONS[f]}`)
      .replace(new RegExp(`[${FRACTION_CHARS}]`, 'g'), (f) => UNICODE_FRACTIONS[f]);
  }

  /** Normalise one raw line: odd spaces, checkbox glyphs, leading bullets. */
  function cleanLine(line) {
    return line
      .replace(/[    \t]/g, ' ')
      .replace(/[​‌‍﻿]/g, '')
      .replace(/[▢☐□☑✓✔]/g, ' ')
      .replace(/^\s*(?:[-–—*•·▪●◦○►▸]|•)+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Lowercase letters-only version of a line, used for heading checks. */
  function headingKey(line) {
    return norm(line)
      .replace(/[’`]/g, "'")
      .replace(/[^a-z' ]+/g, ' ')
      .replace(/\b(\d*x|us|customary|metric|imperial|cups?|grams|scale|servings?)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ---------------- line classification ---------------- */

  const ING_HEAD = /^(ingredients?( list)?|ingredients? for( the)? .{1,30}|what you'?ll need|you'?ll need|what you need)$/;
  const STEP_HEAD = /^(instructions?|directions?|method|steps?|preparation|prep|cooking instructions|cooking directions|to make|how to make( it| this| them)?( .{0,30})?)$/;
  const STOP_HEAD = /^(notes?|recipe notes?|cook'?s notes?|chef'?s notes?|tips?( and tricks)?|recipe tips|expert tips|nutrition( information| facts| info)?|equipment|recommended equipment|video|recipe video|did you make this( recipe)?|tried this recipe|comments?|leave a (comment|reply|review)|reviews?|ratings?|related( recipes| posts)?|more recipes|you may also like|you might also like|storage|how to store( it)?|storing|make ahead|freezing|faqs?|frequently asked questions|reader interactions|share this( recipe)?|about the author|newsletter|serving suggestions)$/;
  const STOP_PREFIX = /^(nutrition|calories\s*:|course\s*:|cuisine\s*:|keywords?\s*:|author\s*:|did you make|tried this|leave a (comment|reply)|rate this|reader interactions|share on|\d+\s+comments?\b|serving\s*:\s*\d|serving size\s*:)/i;

  const JUNK = new RegExp('^(' + [
    'advertisement', 'ad', 'sponsored', 'print', 'print recipe', 'pin', 'pin recipe', 'pin it',
    'save', 'save recipe', 'saved', 'jump to recipe', 'jump to video', 'jump to comments',
    'rate', 'rate recipe', 'rate this recipe', 'share', 'tweet', 'email', 'facebook', 'pinterest',
    'cook mode', 'prevent your screen from going dark', 'deselect all', 'select all',
    '(us customary|us|metric|imperial)(\\s*[-–—/|]\\s*(us customary|us|metric|imperial))*', '\\d+(\\.\\d+)?x', '(\\d+x\\s*)+', 'watch', 'play', 'video',
    'scroll to recipe', 'skip to content', 'skip to recipe', 'go to recipe', 'menu', 'search',
    'add to shopping list', 'add to collection', 'add all ingredients to list',
    'original recipe \\(1x\\) yields .*', 'this recipe was developed .*',
    'photo by .*', 'photo credit.*', 'image credit.*', 'credit: .*', 'dotdash meredith .*',
    '\\(?\\d+ (reviews?|ratings?|votes?|comments?)\\)?', '\\d(\\.\\d)? (from|out of) \\d+.*',
    '\\d(\\.\\d)? stars?.*', '★+.*', '☆+.*', 'updated (on )?.*\\d{4}', 'published (on )?.*\\d{4}',
    '(posted|written) by .*', 'by [a-z.\' -]{2,40}', 'last updated.*',
    'this post may contain affiliate links.*', 'as an amazon associate.*',
  ].join('|') + ')$', 'i');

  const isJunk = (line) => !line || JUNK.test(line) || /^[\W_]+$/.test(line);
  const isIngHeading = (line) => words(line).length <= 7 && ING_HEAD.test(headingKey(line));
  const isStepHeading = (line) => words(line).length <= 7 && STEP_HEAD.test(headingKey(line));
  const isStopHeading = (line) =>
    (words(line).length <= 6 && STOP_HEAD.test(headingKey(line))) || STOP_PREFIX.test(line);

  /* ---------------- amounts and units ---------------- */

  const NUM = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)`;
  const RANGE = String.raw`${NUM}(?:\s*(?:-|–|—|to|or)\s*${NUM})?`;
  const WORD_NUM = String.raw`(?:a dozen|a few|a couple(?: of)?|half(?: a)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|several)(?!\s+and\b)`;

  const UNITS = [
    'cups?', 'c\\.?', 'tablespoons?', 'tbsps?\\.?', 'tbs\\.?', 'tbl\\.?', 'T\\.?',
    'teaspoons?', 'tsps?\\.?', 't\\.?',
    'fluid ounces?', 'fl\\.? ?oz\\.?', 'ounces?', 'oz\\.?', 'pounds?', 'lbs?\\.?',
    'grams?', 'g\\.?', 'gr\\.?', 'kilograms?', 'kgs?\\.?', 'milligrams?', 'mg\\.?',
    'milliliters?', 'millilitres?', 'ml\\.?', 'liters?', 'litres?', 'l\\.?', 'deciliters?', 'dl\\.?',
    'quarts?', 'qts?\\.?', 'pints?', 'pts?\\.?', 'gallons?', 'gals?\\.?',
    'cloves?', 'cans?', 'jars?', 'bottles?', 'boxes', 'box', 'bags?', 'containers?', 'cartons?',
    'packages?', 'pkgs?\\.?', 'packets?', 'envelopes?', 'sticks?', 'blocks?', 'bars?',
    'slices?', 'pieces?', 'pcs?\\.?', 'fillets?', 'heads?', 'bunch(?:es)?', 'sprigs?', 'stalks?', 'stems?',
    'leaves', 'leaf', 'handfuls?', 'pinch(?:es)?', 'dash(?:es)?', 'drops?', 'splash(?:es)?',
    'scoops?', 'knobs?', 'inch(?:es)?', '-inch', 'in\\.', 'cm',
    'sheets?', 'ears?', 'loaf', 'loaves', 'racks?', 'links?', 'strips?', 'wedges?', 'rounds?',
  ];
  const SIZES = ['extra[- ]large', 'x-large', 'large', 'medium', 'small', 'jumbo', 'heaping', 'level', 'scant', 'generous', 'rounded', 'big', 'whole', 'thick', 'thin'];

  const UNIT_RE = new RegExp(`^(?:(?:${SIZES.join('|')})\\s+)*(?:${UNITS.join('|')})(?=[\\s,.(]|$)\\.?`, 'i');
  const SIZE_RE = new RegExp(`^(?:${SIZES.join('|')})(?=\\s)`, 'i');
  const AMOUNT_RE = new RegExp(`^(?:about|approx\\.?|approximately|roughly|around|up to)?\\s*(?:${RANGE}|${WORD_NUM}(?=\\s))`, 'i');

  /** Does this line read like an ingredient ("2 cups flour", "a pinch of salt")? */
  function startsWithAmount(line) {
    const s = asciiFractions(line);
    if (new RegExp(`^${RANGE}`).test(s)) return true;
    if (/^(?:(?:juice|zest|zest and juice) (?:of|from)|(?:a )?(?:pinch|dash|handful|splash|sprinkle) of)\s/i.test(s)) return true;
    const m = s.match(new RegExp(`^${WORD_NUM}\\s+(.*)$`, 'i'));
    return Boolean(m && UNIT_RE.test(m[1]));
  }
  const hasUnitWord = (line) =>
    new RegExp(`\\b${NUM}\\s*(?:${UNITS.slice(0, 40).join('|')})\\b`, 'i').test(asciiFractions(line));

  function ingredientScore(line) {
    if (words(line).length > 22) return -1;          // prose, not an ingredient
    if (startsWithAmount(line)) return 1;
    if (hasUnitWord(line)) return 0.8;
    if (/\bto taste\b|\bfor (serving|garnish|frying|greasing)\b|\boptional\b/i.test(line)) return 0.8;
    if (words(line).length <= 5 && !/[.!?]$/.test(line)) return 0.3;
    return 0;
  }

  /* ---------------- one ingredient line ---------------- */

  const PREP_WORDS = /^(?:freshly|fresh(?=ly)|finely|roughly|coarsely|thinly|thickly|lightly|firmly|loosely|well|very|ripe|packed|sifted|chopped|diced|minced|sliced|grated|shredded|crushed|ground(?= (?:black|white) pepper)|melted|softened|cubed|cooked|uncooked|peeled|halved|quartered|beaten|whisked|divided|drained|rinsed|trimmed|torn|cold|warm|hot|chilled|frozen|thawed|room[- ]temperature)\s+/i;
  const NOTE_TAIL = /\s*(?:,|;|\s-\s|\s–\s|\s—\s)?\s*\b(to taste|plus more.*|plus extra.*|or more.*|or to taste.*|for (?:serving|garnish|garnishing|frying|greasing|dusting|drizzling|topping).*|divided|optional|at room temperature|room temperature|if needed|as needed|if desired|see note.*|\(?see notes?\)?.*)$/i;

  function sentenceCase(name) {
    const ws = words(name);
    const allTitle = ws.length > 1 && ws.every((w) => /^[A-Z][a-z'-]*$|^[a-z]{1,3}$/.test(w));
    const allCaps = /^[^a-z]+$/.test(name) && /[A-Z]{3}/.test(name);
    let s = name;
    if (allTitle || allCaps) s = name.toLowerCase();
    return capFirst(s);
  }

  /**
   * "1 ½ cups (190g) all-purpose flour, sifted"
   *   → [{ name: 'All-purpose flour', amount: '1 1/2 cups (190g), sifted' }]
   * Returns an array because "salt and pepper" is two ingredients.
   */
  function parseIngredientLine(raw) {
    let s = asciiFractions(cleanLine(raw)).replace(/\*+$/, '').trim();
    if (!s) return [];

    const amountParts = [];
    const notes = [];

    // "Juice of 1 lemon" / "Zest of 2 limes"
    const juice = s.match(new RegExp(`^(juice|zest|zest and juice) (?:of|from) (${RANGE}|${WORD_NUM})\\s+(?:(?:${SIZES.join('|')})\\s+)?(.+)$`, 'i'));
    if (juice) {
      s = juice[3];
      amountParts.push(`${juice[1].toLowerCase()} of ${juice[2]}`);
    }

    const pinch = s.match(/^((?:a )?(?:pinch|dash|handful|splash|sprinkle)) of\s+(.+)$/i);
    if (pinch) { amountParts.push(pinch[1].toLowerCase()); s = pinch[2]; }

    // Leading amount, units, sizes and "(14-ounce)" style parentheticals — in any order.
    for (let guard = 0; guard < 8; guard++) {
      let m;
      if ((m = s.match(AMOUNT_RE)) && m[0].trim()) {
        amountParts.push(m[0].trim());
      } else if ((m = s.match(/^\([^)]*\)/))) {
        amountParts.push(m[0]);
      } else if ((m = s.match(UNIT_RE))) {
        amountParts.push(m[0]);
      } else if ((m = s.match(SIZE_RE)) && amountParts.length) {
        amountParts.push(m[0]);
      } else if ((m = s.match(/^\+\s*/)) && amountParts.length) {
        amountParts.push('+');
      } else if (amountParts.length && (m = s.match(new RegExp(`^(?:plus|\\+)\\s+${RANGE}\\s*`, 'i')))) {
        amountParts.push(m[0].trim());
      } else {
        break;
      }
      s = s.slice(m[0].length).trim();
    }
    s = s.replace(/^of\s+/i, '');

    // Pull prep notes off the end ("to taste", "divided", ...).
    let tail;
    while ((tail = s.match(NOTE_TAIL)) && tail.index > 0) {
      notes.unshift(tail[1]);
      s = s.slice(0, tail.index).trim().replace(/[,;]$/, '');
    }

    // Anything in parentheses is a note: "butter (salted or unsalted)".
    s = s.replace(/\(([^)]*)\)/g, (m, inner) => { notes.push(inner.trim()); return ' '; }).replace(/\s+/g, ' ').trim();

    // "boneless, skinless chicken thighs" — a comma between adjectives isn't a prep note.
    s = s.replace(/^((?:\w+less|bone-in|skin-on|ripe|large|small|medium|fresh|raw|organic|unsalted|salted|lean|extra-lean|peeled|seedless|pitted)),\s+(?=\w)/i, '$1 ');

    // After a comma it's preparation: "onion, finely diced".
    const comma = s.search(/,|;/);
    if (comma > 0) {
      notes.unshift(s.slice(comma + 1).trim());
      s = s.slice(0, comma).trim();
    }

    // Alternatives: "butter or margarine" → butter.
    const alt = s.match(/^(.+?)\s+(?:or|\/)\s+(.+)$/i);
    if (alt && !/^(?:half|salt|sweet)$/i.test(alt[1])) {
      notes.push(`or ${alt[2]}`);
      s = alt[1];
    }

    // Leading prep adjectives: "finely chopped fresh parsley" → "fresh parsley".
    // Canned/jarred goods keep them: "crushed tomatoes" is what you buy.
    const packaged = /\b(cans?|jars?|boxe?s?|bags?|packages?|cartons?|containers?)\b/i.test(amountParts.join(' '));
    while (!packaged && PREP_WORDS.test(s) && words(s).length > 1) s = s.replace(PREP_WORDS, '');

    // "4 garlic cloves" → Garlic, 4 cloves
    const cloves = s.match(/^(garlic)\s+(cloves?)$/i);
    if (cloves) { s = cloves[1]; amountParts.push(cloves[2].toLowerCase()); }
    s = s.replace(/^(?:of|a|an)\s+/i, '').replace(/[.:*]+$/, '').trim();

    if (!s || s.length > 60) return [];

    const amount = [amountParts.join(' ').replace(/\s+\+\s+/g, ' + ').replace(/\s+/g, ' '),
      notes.filter(Boolean).join(', ')].filter(Boolean).join(', ');

    // "Salt and pepper" / "Kosher salt and freshly ground black pepper" → two ingredients.
    const sp = s.match(/^((?:kosher |sea |fine |table )?salt)\s+(?:and|&)\s+((?:freshly )?(?:ground )?(?:black |white )?pepper)$/i);
    if (sp) {
      return [
        { name: sentenceCase(sp[1]), amount },
        { name: sentenceCase(sp[2].replace(/^(freshly\s+)?(ground\s+)?/i, '')), amount },
      ];
    }
    return [{ name: sentenceCase(s), amount }];
  }

  /* ---------------- whole recipe ---------------- */

  const META_LABEL = String.raw`prep(?:aration)?|cook(?:ing)?|total|bake|baking|chill(?:ing)?|rest(?:ing)?|inactive|active|marinat(?:e|ing)|rise|rising|freez(?:e|ing)|additional`;
  const META_RE = new RegExp(`^(${META_LABEL})(\\s*time)?\\s*(:)?\\s*(.*)$`, 'i');
  const SERV_RE = /^(servings?|serves|yields?|makes|portions?)\s*(:)?\s*(.*)$/i;
  const DURATION = /\d+\s*(?:-|to)?\s*\d*\s*(?:min|minute|minutes|mins|hr|hrs|hour|hours|h|m|days?)\b/i;
  const looksLikeValue = (v) => /^(?:about |approx\.? |~)?\d/i.test(v);

  /** Recipe-card details like "Prep Time: 15 minutes" and "Servings: 4". */
  function readMeta(lines) {
    const meta = [];
    const seen = new Set();
    const used = new Set();
    lines.forEach((line, i) => {
      if (words(line).length > 8) return;
      let m = line.match(META_RE);
      if (m && (m[2] || m[3])) {
        let value = m[4].trim();
        if (!value && lines[i + 1] && DURATION.test(lines[i + 1]) && looksLikeValue(lines[i + 1])) { value = lines[i + 1]; used.add(i + 1); }
        if (value && DURATION.test(value) && looksLikeValue(value)) {
          const label = `${capFirst(m[1].toLowerCase())} time`;
          if (!seen.has(label)) { seen.add(label); meta.push(`${label}: ${value}`); }
          used.add(i);
        }
        return;
      }
      m = line.match(SERV_RE);
      if (m) {
        let value = m[3].trim();
        if (!value && lines[i + 1] && /^\d/.test(lines[i + 1])) { value = lines[i + 1]; used.add(i + 1); }
        if (looksLikeValue(value) && words(value).length <= 5) {
          if (!seen.has('serv')) { seen.add('serv'); meta.push(`Servings: ${value}`); }
          used.add(i);
        }
      }
    });
    return { meta, used };
  }

  /** Collect the lines of a section that starts after `start`, stopping at the next major heading. */
  function sectionAfter(lines, start, { stopAtSteps = true, stopAtIngredients = true } = {}) {
    const out = [];
    let i = start + 1;
    for (; i < lines.length; i++) {
      const line = lines[i];
      if (isStopHeading(line)) break;
      if (stopAtSteps && isStepHeading(line)) break;
      if (stopAtIngredients && isIngHeading(line)) break;
      out.push({ line, index: i });
    }
    return { items: out, end: i };
  }

  /** Find the real ingredient list: the heading whose section reads most like ingredients. */
  function findIngredientBlock(lines) {
    let best = null;
    lines.forEach((line, i) => {
      if (!isIngHeading(line)) return;
      const { items, end } = sectionAfter(lines, i);
      // A run of prose usually means we're in the blog post, not the recipe card.
      const kept = [];
      let prose = 0;
      for (const it of items) {
        if (isJunk(it.line)) continue;
        if (ingredientScore(it.line) < 0) { if (++prose >= 2 && kept.length) break; continue; }
        kept.push(it);
      }
      const score = kept.reduce((sum, it) => sum + Math.max(0, ingredientScore(it.line)), 0);
      const strong = kept.filter((it) => startsWithAmount(it.line)).length;
      if (!kept.length) return;
      // Later blocks win ties: the printable recipe card sits below the story.
      if (!best || score + strong >= best.score + best.strong) {
        best = { start: i, end, items: kept, score, strong };
      }
    });
    if (best) return best;

    // No heading at all: look for the longest run of lines that start with an amount.
    let run = [];
    let bestRun = [];
    lines.forEach((line, i) => {
      const fits = words(line).length <= 18 && !/[.!?]$/.test(line);
      if (fits && (startsWithAmount(line) || (run.length && ingredientScore(line) >= 0.3))) run.push({ line, index: i });
      else if (!isJunk(line)) { if (run.length > bestRun.length) bestRun = run; run = []; }
    });
    if (run.length > bestRun.length) bestRun = run;
    if (bestRun.length >= 2) {
      return { start: bestRun[0].index, end: bestRun[bestRun.length - 1].index + 1, items: bestRun, score: bestRun.length, strong: bestRun.length };
    }
    return null;
  }

  const isSubheading = (line) =>
    (/:$/.test(line) && words(line).length <= 7 && !startsWithAmount(line)) ||
    /^for (the )?[a-z ]{2,30}:?$/i.test(line);

  function buildIngredients(block) {
    const ingredients = [];
    const amounts = {};
    if (!block) return { ingredients, amounts };
    block.items.forEach(({ line }) => {
      if (isJunk(line) || isSubheading(line)) return;
      parseIngredientLine(line).forEach(({ name, amount }) => {
        const key = norm(name);
        const existing = ingredients.find((x) => norm(x) === key);
        if (!existing) {
          ingredients.push(name);
          if (amount) amounts[key] = amount;
        } else if (amount) {
          amounts[key] = amounts[key] ? `${amounts[key]} + ${amount}` : amount;
        }
      });
    });
    return { ingredients, amounts };
  }

  const STEP_PREFIX = /^(?:step\s*\d+\s*[:.)-]?\s*|\d{1,2}\s*[.)]\s+|\d{1,2}\s*-\s+|\(\d{1,2}\)\s*)/i;

  function buildDirections(lines, block) {
    let start = -1;
    const from = block ? block.end : 0;
    for (let i = from; i < lines.length; i++) {
      if (isStepHeading(lines[i])) { start = i; break; }
    }
    if (start === -1) {
      for (let i = lines.length - 1; i >= 0; i--) {
        if (isStepHeading(lines[i]) && (!block || i > block.start)) { start = i; break; }
      }
    }

    let raw;
    if (start !== -1) {
      raw = sectionAfter(lines, start, { stopAtSteps: false }).items.map((x) => x.line);
    } else {
      // No heading: take sentence-like lines after the ingredients.
      raw = [];
      for (let i = block ? block.end : 0; i < lines.length; i++) {
        const l = lines[i];
        if (isStopHeading(l) || isIngHeading(l)) break;
        if (words(l).length >= 4 && /[.!)]$/.test(l) && !startsWithAmount(l)) raw.push(l);
      }
    }

    // Join "Step 1" on its own line with the text after it; drop junk and captions.
    const steps = [];
    let pendingNumberOnly = false;
    raw.forEach((line) => {
      if (isJunk(line)) return;
      const stripped = line.replace(STEP_PREFIX, '').trim();
      if (!stripped || /^step\s*\d+$/i.test(line) || /^\d{1,2}$/.test(line)) { pendingNumberOnly = true; return; }
      if (isSubheading(stripped) || (/^[A-Z][^.!?]{2,40}$/.test(stripped) && words(stripped).length <= 5 && !pendingNumberOnly && !STEP_PREFIX.test(line))) {
        steps.push({ heading: stripped.replace(/:?$/, ':') });
        pendingNumberOnly = false;
        return;
      }
      const prev = steps[steps.length - 1];
      // A line broken mid-sentence continues the previous step.
      if (prev && prev.text && !/[.!?)]$/.test(prev.text) && /^[a-z(]/.test(stripped) && !STEP_PREFIX.test(line)) {
        prev.text += ` ${stripped}`;
      } else {
        steps.push({ text: stripped });
      }
      pendingNumberOnly = false;
    });

    // Drop headings that ended up with no steps under them.
    const cleaned = steps.filter((s, i) => s.text || (steps[i + 1] && steps[i + 1].text));
    let n = 0;
    return cleaned
      .map((s, i) => (s.heading ? `${i ? '\n' : ''}${s.heading}` : `${++n}. ${s.text}`))
      .join('\n')
      .trim();
  }

  const NAV_WORDS = /^(home|recipes?|about( us| me)?|contact( us)?|shop|search|menu|subscribe|newsletter|log ?in|sign ?(in|up)|my account|dinner|lunch|breakfast|desserts?|appetizers?|sides?|drinks|main dishes|privacy policy|terms|start here|categories|index|all recipes|popular|latest|trending|videos?|news|magazine)$/i;

  function titleCandidate(line) {
    if (isJunk(line) || isIngHeading(line) || isStepHeading(line) || isStopHeading(line)) return false;
    if (NAV_WORDS.test(line) || /[»›|>]\s*\S/.test(line) && /[»›>]/.test(line)) return false;
    if (line.length > 90 || words(line).length > 14) return false;
    if (/[.!?,;]$/.test(line) && !/\.\.\.$/.test(line)) return false;
    if (/^(by|from|updated|published|posted|written|jump|this post|serves|servings|yield|prep|cook|total)\b/i.test(line)) return false;
    if (/^\d/.test(line) || /https?:\/\//i.test(line) || /@/.test(line)) return false;
    if (/\b(19|20)\d{2}\b/.test(line) && /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line)) return false;
    return /[a-z]/i.test(line);
  }

  function tidyTitle(t) {
    let s = t.replace(/^#+\s*/, '').replace(/\s+[|–—-]\s+[^|–—-]{2,40}$/, '').trim();
    s = s.replace(/\s+recipe$/i, '').trim() || s;
    s = s.replace(/^(the )?(best|easy|easiest|perfect|ultimate) /i, (m) => m); // keep their wording
    return s;
  }

  function findTitle(lines, limit) {
    const pool = lines.slice(0, limit).map((line, index) => ({ line, index })).filter((x) => titleCandidate(x.line));
    if (!pool.length) return '';
    // Recipe titles tend to appear twice: once as the article heading, again on the recipe card.
    const counts = {};
    pool.forEach((x) => { const k = norm(tidyTitle(x.line)); counts[k] = (counts[k] || 0) + 1; });
    const repeated = pool.find((x) => counts[norm(tidyTitle(x.line))] >= 2 && words(x.line).length >= 2);
    return tidyTitle((repeated || pool[0]).line);
  }

  function findDescription(lines, limit, title, used) {
    const titleKey = norm(title);
    const isProse = (l) => words(l).length >= 8 && /[.!?)]$/.test(l);
    const blocked = /(affiliate|privacy policy|cookies|newsletter|subscribe|sign up|this post|disclosure|amazon associate|advertis|all rights reserved|©)/i;
    const pool = lines.slice(0, limit).filter((l, i) =>
      !used.has(i) && !isJunk(l) && norm(tidyTitle(l)) !== titleKey && !blocked.test(l) &&
      !isIngHeading(l) && !isStepHeading(l) && !isStopHeading(l));
    const prose = pool.filter(isProse);
    if (prose.length) {
      // Prefer the paragraph just before the ingredients (the recipe card summary) when it is short.
      const last = prose[prose.length - 1];
      const pick = words(last).length <= 60 && prose.length > 2 ? last : prose[0];
      return pick.length > 400 ? `${pick.slice(0, 397).replace(/\s+\S*$/, '')}…` : pick;
    }
    const short = pool.find((l) => words(l).length >= 2 && !titleCandidate(l));
    return short || '';
  }

  function findNotes(lines, from) {
    for (let i = from; i < lines.length; i++) {
      if (/^(recipe |cook'?s |chef'?s )?notes?:?$/i.test(lines[i])) {
        const out = [];
        for (let j = i + 1; j < lines.length && out.length < 8; j++) {
          const l = lines[j];
          if (isStopHeading(l) || isStepHeading(l) || isIngHeading(l)) break;
          if (!isJunk(l)) out.push(l.replace(STEP_PREFIX, '').trim());
        }
        return out;
      }
    }
    return [];
  }

  /** Main entry point. Returns null when the text is empty. */
  function parseRecipe(text) {
    const lines = String(text || '').split(/\r?\n/).map(cleanLine).filter((l) => l && !/^[\s\W]*$/.test(l));
    if (!lines.length) return null;

    const block = findIngredientBlock(lines);
    const headLimit = block ? Math.max(block.start, 1) : lines.length;
    const { meta, used } = readMeta(lines);

    const name = findTitle(lines, headLimit) || findTitle(lines, lines.length) || 'Imported recipe';
    const { ingredients, amounts } = buildIngredients(block);
    const directions = buildDirections(lines, block);
    const summary = findDescription(lines, headLimit, name, used);
    const notes = findNotes(lines, block ? block.end : 0);

    const description = [
      summary,
      meta.join(' · '),
      notes.length ? `Notes:\n${notes.join('\n')}` : '',
    ].filter(Boolean).join('\n\n');

    return { name, description, ingredients, amounts, directions };
  }

  const api = { parseRecipe, parseIngredientLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RecipeParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
