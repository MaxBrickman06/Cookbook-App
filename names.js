/* Cookbook App — short ingredient names
 *
 * Imports (link, text, PDF, photo, fridge photo) shorten ingredient names to the everyday product, so the same
 * thing has one name everywhere and the fridge check and shopping lists line up:
 *
 *   "all-purpose flour"           → Flour             amount keeps "all-purpose"
 *   "unsalted butter"             → Butter            amount keeps "unsalted"
 *   "dark brown sugar"            → Brown sugar       amount keeps "dark"
 *   "extra-virgin olive oil"      → Olive oil
 *   "fresh flat-leaf parsley"     → Parsley
 *   "shredded Parmesan cheese"    → Parmesan
 *   "pure vanilla extract"        → Vanilla extract   ("pure" is just noise: dropped)
 *
 * How it works: a table of everyday products, each with the words that can be dropped from in front of it
 * without turning it into a different product. A name is shortened only when EVERYTHING in front of the product
 * is on its list — so "bread flour", "brown sugar", "sweet potatoes", "peanut butter", "cream cheese" and
 * "flour tortillas" stay exactly as they are. Words that matter when you cook (unsalted, all-purpose, dark,
 * kosher, semi-sweet, boneless…) move into the amount; pure noise (fresh, organic, good-quality…) is dropped.
 *
 * matchKey() is what the fridge check and shopping lists compare: the short name, singular, lower case — so
 * "Eggs" in the fridge counts for a recipe's "1 egg", and "Unsalted butter" typed into the fridge for "Butter".
 *
 * Works in the browser (window.IngredientNames) and in Node (require('./names.js')).
 */
(function (root) {
  'use strict';

  /** Words that never change what you buy: dropped without a trace. */
  const NOISE = ['fresh', 'freshly', 'organic', 'natural', 'pure', 'real', 'good', 'good-quality', 'high-quality',
    'quality', 'premium', 'best', 'homemade', 'store-bought', 'plain'];

  /*
   * Everyday products and the words that can stand in front of them. `name` is how the short name is written
   * (its number follows the original: "potato" / "potatoes"). `keep` words move into the amount; `drop` words
   * are just left out. Listed longest first where one ends another.
   */
  const PRODUCTS = [
    { base: ['flour'], keep: ['all-purpose', 'ap', 'unbleached', 'bleached'] },
    { base: ['brown sugar'], keep: ['light', 'dark', 'packed', 'light-brown', 'dark-brown'] },
    { base: ['sugar'], keep: ['granulated', 'white', 'cane', 'caster', 'superfine', 'fine'] },
    { base: ['butter'], keep: ['unsalted', 'salted', 'sweet cream', 'cold', 'softened', 'melted', 'european', 'european-style', 'cultured'] },
    { base: ['salt'], keep: ['kosher', 'sea', 'flaky', 'fine', 'coarse', 'table', 'iodized', 'flake', 'maldon', 'diamond crystal', 'morton'] },
    { base: ['black pepper'], keep: ['cracked', 'coarsely ground', 'coarse', 'whole'], drop: ['ground', 'finely ground'] },
    { base: ['olive oil'], keep: ['extra-virgin', 'virgin', 'light', 'mild'] },
    { base: ['egg', 'eggs'], keep: ['large', 'extra-large', 'medium', 'small', 'jumbo', 'whole', 'free-range', 'cage-free', 'pasture-raised', 'brown', 'room-temperature'] },
    { base: ['egg yolk', 'egg yolks', 'egg white', 'egg whites'], keep: ['large'] },
    { base: ['vanilla extract', 'vanilla'], keep: [] },
    { base: ['chocolate chips', 'chocolate chip'], keep: ['semi-sweet', 'semisweet', 'bittersweet', 'dark', 'milk', 'mini', 'white'] },
    { base: ['potato', 'potatoes'], keep: ['baby', 'russet', 'yukon gold', 'yukon', 'gold', 'red', 'new', 'white', 'small', 'large', 'medium'] },
    { base: ['onion', 'onions'], keep: ['yellow', 'white', 'brown', 'large', 'medium', 'small', 'sweet', 'vidalia'] },
    { base: ['garlic'], keep: [] },
    { base: ['milk'], keep: ['whole', '2%', '1%', 'skim', 'low-fat', 'reduced-fat', 'full-fat', 'cold', 'warm', 'dairy', "cow's"] },
    { base: ['heavy cream'], keep: ['whipping'] },
    { base: ['heavy whipping cream', 'whipping cream'], keep: [], name: 'Heavy cream' },
    { base: ['chicken breast', 'chicken breasts', 'chicken thigh', 'chicken thighs'], keep: ['boneless', 'skinless', 'bone-in', 'skin-on', 'large', 'small'] },
    { base: ['chicken broth', 'chicken stock', 'beef broth', 'beef stock', 'vegetable broth', 'vegetable stock'], keep: ['low-sodium', 'reduced-sodium', 'unsalted', 'no-salt-added'] },
    { base: ['ground beef', 'ground turkey', 'ground pork', 'ground chicken', 'ground lamb'], keep: ['lean', 'extra-lean', '80/20', '85/15', '90/10', '93/7'] },
    { base: ['tomato', 'tomatoes'], keep: ['ripe', 'roma', 'plum', 'vine-ripened', 'large', 'medium', 'small'] },
    { base: ['spinach', 'carrots', 'carrot'], keep: ['baby'] },
    { base: ['baking soda', 'baking powder', 'cornstarch', 'cinnamon', 'nutmeg', 'paprika', 'cumin', 'oregano', 'thyme', 'rosemary', 'basil',
      'parsley', 'cilantro', 'dill', 'mint', 'chives', 'ginger', 'chili powder', 'garlic powder', 'onion powder', 'cayenne pepper', 'cayenne',
      'maple syrup', 'honey', 'lemon juice', 'lime juice'],
      keep: ['dried', 'flat-leaf', 'italian', 'curly', 'smoked', 'sweet', 'raw'],
      drop: ['ground', 'aluminum-free', 'double-acting', 'squeezed', 'freshly squeezed'] },
  ];

  /* Cheeses: "shredded Parmesan cheese" → Parmesan, "sharp cheddar" → Cheddar. */
  const CHEESES = ['parmesan', 'parmigiano-reggiano', 'parmigiano reggiano', 'mozzarella', 'cheddar', 'feta', 'ricotta', 'swiss', 'provolone',
    'gouda', 'gruyere', 'gruyère', 'pecorino', 'pecorino romano', 'romano', 'monterey jack', 'pepper jack', 'colby jack', 'goat', 'blue', 'asiago',
    'havarti', 'brie', 'mascarpone', 'cotija', 'queso fresco', 'halloumi'];
  const CHEESE_KEEP = ['shredded', 'grated', 'freshly grated', 'sharp', 'extra-sharp', 'mild', 'medium', 'aged', 'whole-milk', 'part-skim',
    'low-moisture', 'crumbled', 'shaved', 'sliced', 'block', 'cubed'];
  const CHEESE_NAMES = { 'parmigiano-reggiano': 'Parmesan', 'parmigiano reggiano': 'Parmesan', goat: 'Goat cheese', blue: 'Blue cheese', 'pecorino romano': 'Pecorino' };

  const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const properCase = (s) => s.replace(/\b(parmesan|cheddar|swiss|gouda|gruyere|gruyère|pecorino|romano|monterey|jack|colby|asiago|havarti|brie|cotija|italian|yukon|vidalia|maldon|morton|european)\b/g, (w) => capFirst(w));

  /** Lower case, one spacing, the usual ways of writing the same word made the same ("all purpose" → "all-purpose"). */
  function tidy(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[®™©]/g, '')
      .replace(/\ball[\s-]?purpose\b/g, 'all-purpose')
      .replace(/\bextra[\s-]virgin\b/g, 'extra-virgin')
      .replace(/\bsemi[\s-]sweet\b/g, 'semi-sweet')
      .replace(/\bextra[\s-]large\b/g, 'extra-large')
      .replace(/\b(low|reduced)[\s-]sodium\b/g, '$1-sodium')
      .replace(/\bbone[\s-]in\b/g, 'bone-in').replace(/\bskin[\s-]on\b/g, 'skin-on')
      .replace(/\bflat[\s-]leaf\b/g, 'flat-leaf')
      .replace(/\broom[\s-]temperature\b/g, 'room-temperature')
      .replace(/\bcorn starch\b/g, 'cornstarch')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Can `prefix` (the words in front of a product) be dropped? Returns the words worth keeping, or null if not. */
  function droppable(prefix, keep, drop = []) {
    let rest = ` ${prefix} `.replace(/,/g, ' ');
    const kept = [];
    // Longest phrases first: "freshly grated" before "grated".
    const phrases = [...keep.map((k) => ({ k, note: true })), ...[...NOISE, ...drop].map((k) => ({ k, note: false }))]
      .sort((a, b) => b.k.length - a.k.length);
    let changed = true;
    while (changed) {
      changed = false;
      for (const { k, note } of phrases) {
        const at = rest.indexOf(` ${k} `);
        if (at === -1) continue;
        if (note) kept.push({ k, at });
        rest = `${rest.slice(0, at)} ${rest.slice(at + k.length + 2)}`;
        changed = true;
      }
    }
    if (rest.replace(/\b(and|&)\b/g, '').trim()) return null;   // something else is in front: a different product
    return kept.sort((a, b) => a.at - b.at).map((x) => x.k);
  }

  /**
   * The short name of an ingredient. Returns { name, note }: `note` holds the words worth keeping
   * ("all-purpose", "unsalted"), '' when there are none. A name it doesn't know comes back as it was
   * (just without noise words such as "fresh" or "organic" in front).
   */
  function shorten(original) {
    const s = tidy(original);
    if (!s) return { name: String(original || ''), note: '' };

    // Cheeses.
    for (const c of [...CHEESES].sort((a, b) => b.length - a.length)) {
      const m = new RegExp(`^(.*?)\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( cheese)?$`).exec(s);
      if (!m) continue;
      const kept = droppable(m[1].trim(), CHEESE_KEEP);
      if (kept) return { name: CHEESE_NAMES[c] || properCase(capFirst(c)), note: kept.join(' ') };
    }

    // Everyday products.
    for (const p of PRODUCTS) {
      for (const base of [...p.base].sort((a, b) => b.length - a.length)) {
        if (s !== base && !s.endsWith(` ${base}`)) continue;
        const kept = droppable(s.slice(0, s.length - base.length).trim(), p.keep, p.drop);
        if (!kept) continue;
        return { name: p.name || properCase(capFirst(base)), note: kept.join(' ') };
      }
    }

    // Anything else: only the noise words in front go ("fresh basil leaves" → Basil leaves).
    const words = s.split(' ');
    let i = 0;
    while (i < words.length - 1 && NOISE.includes(words[i])) i++;
    if (i === 0) return { name: String(original).trim(), note: '' };
    return { name: properCase(capFirst(words.slice(i).join(' '))), note: '' };
  }

  /** Put the kept words into an amount: "1 cup (226g), sifted" + "unsalted" → "1 cup (226g), unsalted, sifted". */
  function withNote(amount, note) {
    if (!note) return amount || '';
    const a = String(amount || '');
    if (!/^[\d½⅓⅔¼¾⅛?]/.test(a)) return [note, a].filter(Boolean).join(', ');   // no quantity: "flaky sea, for topping"
    const comma = a.indexOf(', ');
    const qty = comma === -1 ? a : a.slice(0, comma);
    const rest = comma === -1 ? '' : a.slice(comma + 2);
    return [qty, note, rest].filter(Boolean).join(', ');
  }

  /**
   * Shorten every ingredient of an imported recipe, merging any that become the same
   * ("kosher salt" and "flaky sea salt" → one Salt, amounts joined with " + ").
   * ingredients: [names], amounts: { lower-case name: amount }. Returns a new { ingredients, amounts }.
   */
  function shortenAll(ingredients, amounts = {}) {
    const out = [];
    const outAmounts = {};
    (ingredients || []).forEach((full) => {
      const { name, note } = shorten(full);
      const amount = withNote(amounts[String(full).toLowerCase()] || '', note);
      const key = name.toLowerCase();
      if (!out.some((n) => n.toLowerCase() === key)) {
        out.push(name);
        if (amount) outAmounts[key] = amount;
      } else if (amount) {
        outAmounts[key] = outAmounts[key] ? `${outAmounts[key]} + ${amount}` : amount;
      }
    });
    return { ingredients: out, amounts: outAmounts };
  }

  /** One word's singular: "tomatoes" → "tomato", "berries" → "berry", "leaves" → "leaf". */
  function singular(w) {
    if (w.length <= 3 || /(ss|us|is)$/.test(w)) return w;
    if (/ies$/.test(w)) return `${w.slice(0, -3)}y`;
    if (/ves$/.test(w)) return `${w.slice(0, -3)}f`;
    if (/(oes|ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2);
    if (/s$/.test(w)) return w.slice(0, -1);
    return w;
  }

  /** What the fridge check and shopping lists compare: short name, singular, lower case. */
  function matchKey(name) {
    return shorten(name).name.toLowerCase().split(' ').map(singular).join(' ');
  }

  const api = { shorten, shortenAll, withNote, matchKey, singular };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IngredientNames = api;
})(typeof window !== 'undefined' ? window : globalThis);
