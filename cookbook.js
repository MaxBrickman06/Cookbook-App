/* Cookbook App — recipe rules shared by the app and the tests
 *
 * The parts of the requirements spec that decide pass/fail live here as plain functions,
 * so `node --test` can check them without a browser:
 *   FR-1  recipe names (1–100 characters, empty name → first line of the description, or no save)
 *   FR-2  search with comma-separated terms (every term must match, any letter case)
 *   FR-3  ingredients you don't have are listed first
 *   FR-4  adding missing ingredients to shopping lists never duplicates an item
 *   US-1  have / on a list / need (blue / yellow / red), complete recipes first in search results
 *
 * Works in the browser (window.Cookbook) and in Node (require('./cookbook.js')).
 */
(function (root) {
  'use strict';

  const Parser = typeof module !== 'undefined' && module.exports ? require('./parser.js') : root.RecipeParser;

  const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();

  /* ---------------- FR-1: recipe names ---------------- */

  const NAME_MAX = 100;

  const MESSAGES = {
    nameFilled: 'The recipe name was empty, so it was filled with the first line of the description. Check it, then press Save again.',
    nameRequired: 'Give the recipe a name before saving.',
    nameTooLong: `Recipe names can be at most ${NAME_MAX} characters.`,
  };

  /**
   * Decide whether a recipe draft can be saved under its name.
   *   { status: 'ok',      name }            — save it
   *   { status: 'filled',  name, message }   — name was empty; filled from the description's first line.
   *                                            Not saved yet: the user is warned and presses Save again.
   *   { status: 'blocked', message }         — name and description both empty; can't be saved
   *   { status: 'too-long', message }        — over 100 characters
   */
  function checkRecipeName(draft) {
    const name = String(draft.name || '').trim();
    if (name.length > NAME_MAX) return { status: 'too-long', message: MESSAGES.nameTooLong };
    if (name) return { status: 'ok', name };
    const firstLine = String(draft.description || '').split('\n').map((l) => l.trim()).find(Boolean);
    if (firstLine) {
      return { status: 'filled', name: firstLine.slice(0, NAME_MAX).trim(), message: MESSAGES.nameFilled };
    }
    return { status: 'blocked', message: MESSAGES.nameRequired };
  }

  /* ---------------- FR-2: search ---------------- */

  /** "eggs, milk and butter" → ['eggs', 'milk', 'butter'] — every term has to match. */
  function searchTerms(q) {
    return String(q || '').split(/,|;|\+|&|\band\b/i).map(norm).filter(Boolean);
  }

  /** Case-insensitive; "tomatoes" also finds "Tomato", "eggs" finds "Egg". */
  function termMatches(text, term) {
    const t = norm(text);
    term = norm(term);
    if (t.includes(term)) return true;
    const singular = term.length > 3 ? term.replace(/(es|s)$/, '') : term;
    return singular !== term && t.includes(singular);
  }

  /** scope: 'all' (name & ingredients), 'name' or 'ingredients'. No terms → everything matches. */
  function matchesSearch(recipe, terms, scope = 'all') {
    return terms.every((t) =>
      (scope !== 'ingredients' && termMatches(recipe.name, t)) ||
      (scope !== 'name' && (recipe.ingredients || []).some((i) => termMatches(i, t))));
  }

  /* ---------------- FR-3 / US-1: what you have ---------------- */

  const inFridge = (fridge, name) => fridge.some((f) => norm(f) === norm(name));

  /** Lists that already have this item and haven't checked it off. */
  function listsWith(lists, name) {
    return lists.filter((l) => l.items.some((i) => !i.done && norm(i.name) === norm(name)));
  }

  /**
   * One ingredient's state:
   *   'have'   — in the fridge                         (blue)
   *   'listed' — not in the fridge, but on a list      (yellow)
   *   'need'   — not in the fridge or on any list      (red)
   *   'plain'  — the recipe has its fridge check turned off
   */
  function ingredientState(recipe, name, fridge, lists) {
    if (recipe.useFridge === false) return 'plain';
    if (inFridge(fridge, name)) return 'have';
    return listsWith(lists, name).length ? 'listed' : 'need';
  }

  const STATE_ORDER = { need: 0, listed: 1, have: 2, plain: 3 };

  /** Ingredients in display order: need (red) first, then on a list (yellow), then have (blue). */
  function ingredientRows(recipe, fridge, lists) {
    return (recipe.ingredients || [])
      .map((name, i) => ({ name, i, state: ingredientState(recipe, name, fridge, lists), lists: listsWith(lists, name).map((l) => l.name) }))
      .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.i - b.i)
      .map(({ i, ...row }) => row);
  }

  /** Everything the recipe still needs from the shop: yellow and red ingredients. */
  function neededFor(recipe, fridge) {
    if (recipe.useFridge === false) return [];
    return (recipe.ingredients || []).filter((n) => !inFridge(fridge, n));
  }

  /** "Complete" = every ingredient is in the fridge. */
  const isComplete = (recipe, fridge) => (recipe.ingredients || []).length > 0 && neededFor(recipe, fridge).length === 0
    && recipe.useFridge !== false;

  /* ---------------- FR-4: adding to shopping lists ---------------- */

  /**
   * Add each name to each chosen list once, skipping ones already on that list (and repeats in `names`).
   * Changes the lists in place. Returns { [listId]: number added }.
   */
  function addToLists(lists, listIds, names) {
    const added = {};
    listIds.forEach((id) => {
      const list = lists.find((l) => l.id === id);
      if (!list) return;
      added[id] = 0;
      names.forEach((n) => {
        if (!String(n).trim()) return;
        if (list.items.some((i) => !i.done && norm(i.name) === norm(n))) return;
        list.items.push({ name: n, done: false });
        added[id]++;
      });
    });
    return added;
  }

  /* ---------------- time ---------------- */

  /** Minutes in a recipe's "Estimated time" field, or 0 when it's empty or unreadable. */
  const recipeMinutes = (recipe) => Parser.parseMinutes(recipe.time || '');

  /* ---------------- US-1: search result order ---------------- */

  /** Complete recipes first, then incomplete; favorites first inside each group; otherwise keep the order. */
  function orderResults(recipes, fridge) {
    return recipes
      .map((r, i) => ({ r, i }))
      .sort((a, b) =>
        (isComplete(b.r, fridge) - isComplete(a.r, fridge)) ||
        (Boolean(b.r.favorite) - Boolean(a.r.favorite)) ||
        a.i - b.i)
      .map((x) => x.r);
  }

  const api = {
    NAME_MAX, MESSAGES, checkRecipeName,
    searchTerms, termMatches, matchesSearch,
    inFridge, listsWith, ingredientState, ingredientRows, neededFor, isComplete,
    addToLists, recipeMinutes, orderResults,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cookbook = api;
})(typeof window !== 'undefined' ? window : globalThis);
