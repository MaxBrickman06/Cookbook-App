/* Cookbook App — browser demo
 * Plain JavaScript, no frameworks, no AI. All data lives in localStorage.
 * Recipe text scanning lives in parser.js (window.RecipeParser).
 */

const STORAGE_KEY = 'cookbook-demo-v1';

/* ---------------- helpers ---------------- */

const uid = () => Math.random().toString(36).slice(2, 10);
const norm = (s) => String(s).trim().toLowerCase();
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const splitItems = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);

/* ---------------- data ---------------- */

function seedData() {
  return {
    recipes: [
      {
        id: uid(),
        name: 'Cheesy Garlic Potato Bites',
        description: 'Crispy fried potato bites with a melty cheese center.',
        ingredients: ['Potatoes', 'Parmesan cheese', 'Mozzarella', 'Garlic powder', 'Eggs', 'Cornstarch'],
        amounts: { potatoes: '2 lb', 'parmesan cheese': '1/2 cup, grated', mozzarella: '1 cup, cubed', 'garlic powder': '1 tsp', eggs: '1', cornstarch: '1/4 cup' },
        directions: '1. Boil and mash the potatoes, then let them cool.\n2. Mix in the parmesan, garlic powder, egg and cornstarch.\n3. Wrap a spoonful around a cube of mozzarella and roll into a ball.\n4. Fry until golden and crispy.',
        time: '45 min',
        favorite: true,
        useFridge: true,
      },
      {
        id: uid(),
        name: 'Pancakes',
        description: 'Fluffy weekend pancakes.',
        ingredients: ['Flour', 'Sugar', 'Eggs', 'Milk', 'Butter', 'Baking powder'],
        amounts: { flour: '1 1/2 cups', sugar: '2 tbsp', eggs: '1', milk: '1 1/4 cups', butter: '3 tbsp, melted', 'baking powder': '1 tbsp' },
        time: '20 min',
        directions: '1. Whisk the flour, sugar and baking powder.\n2. Whisk the milk, egg and melted butter in another bowl.\n3. Combine until just mixed — a few lumps are fine.\n4. Cook on a hot buttered pan until bubbles form, then flip.',
        favorite: false,
        useFridge: true,
      },
      {
        id: uid(),
        name: 'Cajun Roasted Potatoes',
        description: 'Easy spicy side dish.',
        ingredients: ['Potatoes', 'Olive oil', 'Cajun seasoning'],
        amounts: { potatoes: '1 1/2 lb, halved', 'olive oil': '2 tbsp', 'cajun seasoning': '1 tbsp' },
        time: '40 min',
        directions: '1. Heat the oven to 425°F.\n2. Toss the halved potatoes in oil and Cajun seasoning.\n3. Roast for about 35 minutes, turning once.',
        favorite: false,
        useFridge: true,
      },
    ],
    fridge: ['Eggs', 'Milk', 'Potatoes', 'Garlic powder', 'Olive oil', 'Cajun seasoning'],
    lists: [
      { id: uid(), name: 'Weekly groceries', items: [{ name: 'Bread', done: false }] },
    ],
  };
}

/** Fill in fields added after a recipe was first saved (favorite, directions, amounts). */
function upgradeRecipe(r) {
  return {
    ...r,
    description: r.description || '',
    directions: r.directions || '',
    time: r.time || '',
    favorite: Boolean(r.favorite),
    amounts: r.amounts || {},
    image: r.image || '',
    source: r.source || '',
    ingredients: r.ingredients || [],
    useFridge: r.useFridge !== false,
  };
}

function loadState() {
  let data = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) data = JSON.parse(raw);
  } catch (e) { /* storage unavailable — fall back to seed */ }
  data = data || seedData();
  data.recipes = data.recipes.map(upgradeRecipe);
  return data;
}

let state = loadState();

/** Returns false when the browser refuses to store the data (usually: storage full of photos). */
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

/* UI-only state (not saved) */
const ui = {
  view: 'library',
  recipeId: null,
  focusKey: null,
  link: { status: 'idle' },   // link import: idle | loading | error
  importText: '',
  editing: false,             // recipe page: false = read-only view, true = edit form
  draft: null,                // the copy being edited; only written to the recipe on Save
  draftOriginal: '',          // snapshot to tell whether anything changed
  isNewRecipe: false,         // a new recipe isn't added to the library until it's saved
  filter: { q: '', scope: 'all', favorites: false, canMake: false, missing: false, maxTime: 0 },
  editorNotice: null,         // { kind: 'warn' | 'error', text } shown at the top of the edit form
  listPicker: null,           // "Add to List" window: { names: [...], selected: [listIds], newList: bool, newName }
  importDialog: null,         // Import window on the library page: { mode: 'menu' | 'url' | 'text' }
  busy: null,                 // "Reading cookbook.pdf…" window while a file is read: { title, message }
  pdfPick: null,              // a PDF with several recipes: { name, pdf, choices: [{ title, from, to }] }
};

const NO_FILTERS = () => ({ q: '', scope: ui.filter ? ui.filter.scope : 'all', favorites: false, canMake: false, missing: false, maxTime: 0 });
const C = window.Cookbook;   // shared rules (cookbook.js) — also checked by the tests

/* Link import needs server.js; opened as a plain file it can't fetch other sites. */
const SERVER_MODE = /^https?:$/.test(location.protocol);

/* ---------------- domain logic ---------------- */

const findRecipe = (id) => state.recipes.find((r) => r.id === id);
const findList = (id) => state.lists.find((l) => l.id === id);
const inFridge = (name) => C.inFridge(state.fridge, name);
const amountOf = (recipe, name) => (recipe.amounts || {})[norm(name)] || '';

/** Library order: favorites first, otherwise the order recipes were added. */
const sortedRecipes = () => [
  ...state.recipes.filter((r) => r.favorite),
  ...state.recipes.filter((r) => !r.favorite),
];

const STAR_PATH = 'M12 2.8l2.82 5.72 6.31.92-4.57 4.45 1.08 6.29L12 17.21l-5.64 2.97 1.08-6.29L2.87 9.44l6.31-.92z';
const PDF_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" class="photo-icon">
    <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
    <path d="M14 3v5h5M9 13h6M9 16.5h6"/>
  </svg>`;
const PHOTO_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" class="photo-icon">
    <rect x="3" y="5" width="18" height="14" rx="2.5"/>
    <circle cx="9" cy="10" r="1.8"/>
    <path d="M4 17l5-4.5 3.5 3 3-2.5L20 17"/>
  </svg>`;

/** Library thumbnail: the dish photo (or an empty frame) with the favorite star in the corner. */
function recipeThumb(r) {
  const label = esc(r.name || 'Untitled recipe');
  const body = r.image
    ? `<button class="thumb-open" data-action="open-recipe" data-id="${r.id}" aria-label="Open ${label}">
         <img src="${esc(r.image)}" alt="${label}" loading="lazy"
              onerror="this.closest('.thumb').classList.add('broken')">
         <span class="thumb-broken">${PHOTO_ICON}Image couldn't load</span>
       </button>`
    : `<button class="thumb-open thumb-empty" data-action="open-recipe" data-id="${r.id}" data-then="photo"
               aria-label="Add a photo to ${label}">
         ${PHOTO_ICON}<span>Add a photo</span>
       </button>`;
  return `<div class="thumb ${r.image ? '' : 'empty'}">${body}${starButton(r, 'overlay')}</div>`;
}

function starButton(r, size = 'small') {
  const on = r.favorite;
  const label = on ? `Remove ${r.name || 'recipe'} from favorites` : `Add ${r.name || 'recipe'} to favorites`;
  return `
    <button class="star-btn ${size} ${on ? 'on' : ''}" data-action="toggle-favorite" data-id="${r.id}"
            aria-pressed="${on}" aria-label="${esc(label)}" title="${on ? 'Favorited' : 'Add to favorites'}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg>
    </button>`;
}

/**
 * Ingredients for display, red first: need (not in fridge or any list), then listed (on a shopping list),
 * then have (in the fridge). `missing` is true for need and listed.
 */
function orderedIngredients(recipe) {
  return C.ingredientRows(recipe, state.fridge, state.lists)
    .map((row) => ({ ...row, missing: row.state === 'need' || row.state === 'listed' }));
}

/** Everything still to buy for this recipe (red and yellow ingredients). */
const missingFor = (recipe) => C.neededFor(recipe, state.fridge);

function addToFridge(names) {
  let added = 0;
  names.forEach((n) => {
    if (!inFridge(n)) { state.fridge.push(n); added++; }
  });
  return added;
}

/** "Add to List" window: open it for these ingredients (all the recipe needs, or one row's item). */
function openListPicker(names) {
  ui.listPicker = {
    names,
    selected: state.lists.length ? [state.lists[0].id] : [],
    newList: !state.lists.length,
    newName: '',
  };
  render();
}

/** Confirm in the "Add to List" window: each chosen list gets every item it doesn't already have (FR-4). */
function confirmListPicker(recipe) {
  const p = ui.listPicker;
  if (!p) return;
  const ids = [...p.selected];
  if (p.newList) {
    const list = { id: uid(), name: p.newName.trim() || `For ${(recipe && recipe.name) || 'recipe'}`, items: [] };
    state.lists.push(list);
    ids.push(list.id);
  }
  if (!ids.length) { toast('Pick at least one list'); return; }
  const added = C.addToLists(state.lists, ids, p.names);
  save();
  ui.listPicker = null;
  render();
  const parts = ids.map((id) => `${added[id] ? plural(added[id], 'item') : 'nothing new'} → “${findList(id).name}”`);
  toast(parts.join(' · '));
}

/* ---------------- rendering ---------------- */

const app = document.getElementById('app');

function render() {
  document.querySelectorAll('.tab').forEach((t) => {
    const v = ui.view === 'recipe' ? 'library' : ui.view;
    t.classList.toggle('active', t.dataset.view === v);
  });

  const views = {
    library: renderLibrary,
    recipe: renderRecipe,
    fridge: renderFridge,
    lists: renderLists,
    import: renderImport,
  };
  app.innerHTML = (views[ui.view] || renderLibrary)() + renderModal();
  document.body.classList.toggle('modal-open', Boolean(app.querySelector('.modal')));

  app.querySelectorAll('textarea[data-autosize]').forEach(autosize);
  syncTopbarHeight();

  if (ui.focusKey) {
    const el = app.querySelector(`[data-focus="${ui.focusKey}"]`);
    if (el) el.focus();
    ui.focusKey = null;
  }
}

/** The sticky Save/Cancel bar sits just under the header, whose height changes with screen width. */
function syncTopbarHeight() {
  const bar = document.querySelector('.topbar');
  if (bar) document.documentElement.style.setProperty('--topbar-h', `${Math.round(bar.getBoundingClientRect().height)}px`);
}
window.addEventListener('resize', syncTopbarHeight);

/** Grow a textarea to fit its text so imported directions are readable without scrolling. */
function autosize(el) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight + 2, 900)}px`;
}

/* ---------------- library search & filters ---------------- */

/* Search rules live in cookbook.js (FR-2): every comma-separated term must match, any letter case. */
const searchTerms = C.searchTerms;
const ingredientMatches = (name, terms) => terms.some((t) => C.termMatches(name, t));
const canMakeNow = (r) => C.isComplete(r, state.fridge);
/** Recipes the fridge check applies to and that are short of something. */
const isIncomplete = (r) => r.useFridge && r.ingredients.length > 0 && !canMakeNow(r);

const TIME_FILTERS = [[0, 'Any time'], [15, '≤ 15 min'], [30, '≤ 30 min'], [60, '≤ 1 hr'], [120, '≤ 2 hr']];

function filteredRecipes() {
  const { q, scope, favorites, canMake, missing, maxTime } = ui.filter;
  const terms = searchTerms(q);
  const list = sortedRecipes().filter((r) => {
    if (favorites && !r.favorite) return false;
    if (canMake && !canMakeNow(r)) return false;
    if (missing && !isIncomplete(r)) return false;
    if (maxTime) {
      const min = C.recipeMinutes(r);
      if (!min || min > maxTime) return false;
    }
    return C.matchesSearch(r, terms, scope);
  });
  // While searching, recipes you can make right now come first (US-1).
  return terms.length ? C.orderResults(list, state.fridge) : list;
}

const filtersActive = () => {
  const f = ui.filter;
  return Boolean(f.q.trim() || f.favorites || f.canMake || f.missing || f.maxTime);
};

function recipeCard(r, terms) {
  const ings = orderedIngredients(r);
  const missing = ings.filter((i) => i.missing).length;
  let status = '';
  if (!r.useFridge) status = '<span class="tag">fridge check off</span>';
  else if (!r.ingredients.length) status = '<span class="tag">no ingredients</span>';
  else if (missing) status = `<span class="tag need">${missing} missing</span>`;
  else status = '<span class="tag ready">ready to cook</span>';
  const highlight = ui.filter.scope !== 'name' && terms.length;
  const alert = isIncomplete(r)
    ? '<span class="incomplete-mark" title="Some ingredients aren\'t in your fridge" aria-label="Incomplete">!</span>'
    : '';

  return `
      <article class="recipe-card ${r.favorite ? 'fav' : ''}">
        <div class="card-top">
          <h3>${alert}${esc(r.name || 'Untitled recipe')}</h3>
          <button class="btn ghost small" data-action="open-recipe" data-id="${r.id}">Open</button>
        </div>
        ${recipeThumb(r)}
        <div class="card-meta">${status}<span class="tag">${plural(r.ingredients.length, 'ingredient')}</span>${r.time.trim() ? `<span class="tag">⏱ ${esc(r.time.trim())}</span>` : ''}</div>
        ${r.description.trim() ? `<p class="card-desc">${esc(r.description.trim())}</p>` : ''}
        ${ings.length
          ? `<ul class="mini-ings">${ings.map((i) => {
              const cls = [i.state === 'need' ? 'missing' : '', i.state === 'listed' ? 'listed' : '', highlight && ingredientMatches(i.name, terms) ? 'match' : ''].join(' ').trim();
              return `<li class="${cls}">${esc(i.name)}</li>`;
            }).join('')}</ul>`
          : ''}
      </article>`;
}

/** The part of the library that changes while typing in the search box. */
function renderLibraryResults() {
  const list = filteredRecipes();
  const terms = searchTerms(ui.filter.q);
  const total = state.recipes.length;
  if (!total) return '<div class="empty">Your library is empty. Create your first recipe.</div>';
  const count = filtersActive()
    ? `<p class="results-count">Showing ${list.length} of ${plural(total, 'recipe')} · <button class="link-btn" data-action="filter-clear">Clear search &amp; filters</button></p>`
    : '';
  if (!list.length) {
    return `${count}<div class="empty">No recipes match.${ui.filter.canMake ? ' Nothing can be made with only what\'s in your fridge.' : ''}${ui.filter.maxTime ? ' Recipes without an estimated time are hidden by the time filter.' : ''}</div>`;
  }
  return `${count}<div class="recipe-grid">${list.map((r) => recipeCard(r, terms)).join('')}</div>`;
}

const SEARCH_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" class="search-icon"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';

function renderLibrary() {
  const favCount = state.recipes.filter((r) => r.favorite).length;
  const f = ui.filter;
  const scopes = [['all', 'Name & ingredients'], ['name', 'Name'], ['ingredients', 'Ingredients']];
  const placeholder = {
    all: 'Search recipes or ingredients — e.g. chicken, garlic',
    name: 'Search recipe names',
    ingredients: 'Ingredients — e.g. eggs, milk, butter',
  }[f.scope];

  return `
    <div class="view-head">
      <div>
        <h2>Recipe Library</h2>
        <p class="sub">${plural(state.recipes.length, 'recipe')}${favCount ? ` · ${favCount} ★ favorite${favCount === 1 ? '' : 's'} pinned to the top` : ''} · red ingredients aren't in your fridge, yellow ones are on a list</p>
      </div>
      <span class="toolbar-right">
        <button class="btn ghost" data-action="import-open">⤓ Import</button>
        <button class="btn" data-action="new-recipe">+ New recipe</button>
      </span>
    </div>

    ${state.recipes.length ? `
    <div class="library-tools" role="search">
      <label class="search-box">
        ${SEARCH_ICON}
        <input type="search" data-filter="q" data-focus="search" value="${esc(f.q)}" autocomplete="off"
               placeholder="${esc(placeholder)}" aria-label="Search recipes">
      </label>
      <div class="filter-row">
        <div class="seg" role="group" aria-label="Search in">
          ${scopes.map(([key, label]) => `<button class="${f.scope === key ? 'on' : ''}" data-action="filter-scope" data-scope="${key}" aria-pressed="${f.scope === key}">${label}</button>`).join('')}
        </div>
        <span class="filter-spacer"></span>
        <button class="chip-toggle ${f.favorites ? 'on' : ''}" data-action="filter-toggle" data-key="favorites" aria-pressed="${f.favorites}">★ Favorites only</button>
        <button class="chip-toggle ${f.canMake ? 'on' : ''}" data-action="filter-toggle" data-key="canMake" aria-pressed="${f.canMake}"
                title="Only recipes where every ingredient is in your fridge">Can make now</button>
        <button class="chip-toggle ${f.missing ? 'on' : ''}" data-action="filter-toggle" data-key="missing" aria-pressed="${f.missing}"
                title="Only recipes that are missing something from your fridge">! Missing ingredients</button>
        <select class="chip-select ${f.maxTime ? 'on' : ''}" data-action="filter-time" aria-label="Time to make">
          ${TIME_FILTERS.map(([v, label]) => `<option value="${v}" ${f.maxTime === v ? 'selected' : ''}>⏱ ${label}</option>`).join('')}
        </select>
      </div>
      <p class="search-hint">Separate ingredients with commas to find recipes that use all of them.</p>
    </div>` : ''}

    <div id="library-results">${renderLibraryResults()}</div>`;
}


/* ---------------- recipe page: read-only view ---------------- */

/** Escape text, then make web links clickable. */
function linkify(text) {
  return esc(text).replace(/https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g,
    (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
}

function proseHtml(text) {
  return text.trim().split(/\n\s*\n/)
    .map((para) => `<p>${linkify(para.trim()).replace(/\n/g, '<br>')}</p>`).join('');
}

/** "1. Boil…" lines become numbered steps; "For the sauce:" lines become small headings. */
function directionsHtml(text) {
  const out = [];
  let open = false;
  let auto = 0;
  const closeList = () => { if (open) { out.push('</ol>'); open = false; } };
  text.split('\n').map((l) => l.trim()).filter(Boolean).forEach((line) => {
    const m = line.match(/^(?:step\s*)?(\d{1,2})\s*[.):-]\s*(.+)$/i);
    if (m) {
      if (!open) { out.push('<ol class="steps">'); open = true; }
      auto = Number(m[1]);
      out.push(`<li><span class="step-num">${auto}</span><p>${linkify(m[2])}</p></li>`);
    } else if (/:$/.test(line) && line.split(/\s+/).length <= 7) {
      closeList();
      out.push(`<h4 class="step-group">${esc(line.replace(/:$/, ''))}</h4>`);
    } else if (open) {
      out.push(`<li><span class="step-num">${++auto}</span><p>${linkify(line)}</p></li>`);
    } else {
      out.push(`<p class="step-text">${linkify(line)}</p>`);
    }
  });
  closeList();
  return out.join('');
}

function renderRecipe() {
  if (ui.editing && ui.draft) return renderRecipeEditor(ui.draft);
  const r = findRecipe(ui.recipeId);
  if (!r) { ui.view = 'library'; return renderLibrary(); }
  return renderRecipeView(r);
}

const STATE_TAGS = {
  need: '<span class="tag need">need</span>',
  listed: '<span class="tag listed">on a list</span>',
  have: '<span class="tag have">have</span>',
  plain: '',
};

function renderRecipeView(r) {
  const ings = orderedIngredients(r);
  const missing = ings.filter((i) => i.missing);
  const need = missing.filter((i) => i.state === 'need').length;
  const listed = missing.length - need;
  const hasDesc = Boolean(r.description.trim());
  const hasDirections = Boolean(r.directions.trim());

  const rows = ings.map((i) => {
    const amount = amountOf(r, i.name);
    const listTag = i.state === 'listed' ? `<span class="on-lists">${esc(i.lists.join(', '))}</span>` : '';
    const actions = i.missing ? `
        <span class="row-actions">
          <button class="btn ghost small" data-action="add-missing-one" data-name="${esc(i.name)}" title="Add to a shopping list">+ List</button>
          <button class="btn ghost small" data-action="ingredient-to-fridge" data-name="${esc(i.name)}" title="I have this now">Got it</button>
        </span>` : '';
    return `
      <li class="ing-${i.state}">
        <span class="ing-name">${esc(i.name)}${amount ? ` <span class="ing-amount">${esc(amount)}</span>` : ''}</span>
        ${listTag}${STATE_TAGS[i.state]}${actions}
      </li>`;
  }).join('');

  // The "Add to List" button only shows when something is yellow or red (US-1).
  const missingBar = missing.length ? `
    <div class="missing-bar">
      <strong>${[need ? `${need} needed` : '', listed ? `<span class="listed-count">${listed} on a list</span>` : ''].filter(Boolean).join(' · ')}</strong>
      <span class="spacer"></span>
      <button class="btn small" data-action="add-missing-all">+ Add to List</button>
    </div>` : '';

  const nothingYet = !hasDesc && !ings.length && !hasDirections && !r.image;

  return `
    <div class="toolbar">
      <button class="btn ghost" data-action="nav" data-view="library">← Library</button>
      <span class="toolbar-right">
        ${starButton(r, 'large')}
        <button class="btn" data-action="edit-recipe">✎ Edit</button>
      </span>
    </div>

    ${r.image ? `
    <div class="recipe-hero">
      <img src="${esc(r.image)}" alt="${esc(r.name || 'Recipe')} — finished dish"
           onerror="this.parentNode.remove()">
    </div>` : ''}

    <header class="recipe-head">
      <h1 class="recipe-title">${esc(r.name || 'Untitled recipe')}</h1>
      ${r.time.trim() ? `<p class="recipe-time">⏱ ${esc(r.time.trim())}</p>` : ''}
      ${sourceLine(r)}
    </header>

    ${hasDesc ? `<section class="panel prose">${proseHtml(r.description)}</section>` : ''}

    ${ings.length ? `
    <section class="panel">
      <div class="panel-head"><h3>Ingredients <span class="sub">(${ings.length})</span></h3>
        ${r.useFridge ? '<span class="legend"><span class="dot need"></span>need <span class="dot listed"></span>on a list <span class="dot have"></span>have</span>' : ''}</div>
      ${missingBar}
      <ul class="ing-list view">${rows}</ul>
    </section>` : ''}

    ${hasDirections ? `
    <section class="panel">
      <div class="panel-head"><h3>Directions</h3></div>
      <div class="directions-view">${directionsHtml(r.directions)}</div>
    </section>` : ''}

    ${hasDirections || !ings.length ? '' : `
    <section class="panel">
      <div class="panel-head"><h3>Directions</h3></div>
      <p class="sub" style="margin:0">No directions yet — press ✎ Edit to add them.</p>
    </section>`}

    ${nothingYet ? `
    <div class="empty">Nothing added to this recipe yet.
      <div style="margin-top:10px"><button class="btn" data-action="edit-recipe">✎ Add details</button></div>
    </div>` : ''}`;
}

/* ---------------- recipe page: edit mode ---------------- */

const EDIT_FIELDS = ['name', 'description', 'time', 'directions', 'ingredients', 'amounts', 'image', 'useFridge', 'source'];
const editableCopy = (r) => JSON.parse(JSON.stringify(EDIT_FIELDS.reduce((o, k) => { o[k] = r[k]; return o; }, {})));
const draftDirty = () => Boolean(ui.editing && ui.draft && JSON.stringify(ui.draft) !== ui.draftOriginal);

/**
 * isNew: the recipe isn't in the library yet and is only added on Save.
 * imported: the form was pre-filled by an import, so Cancel can close it without asking (use case 6a).
 */
function startEditing(recipe, isNew = false, { imported = false, notice = null } = {}) {
  ui.draft = editableCopy(recipe);
  ui.draftOriginal = isNew && !imported ? '' : JSON.stringify(ui.draft);
  ui.isNewRecipe = isNew;
  ui.isImport = imported;
  ui.editing = true;
  ui.editorNotice = notice;
}

function stopEditing() {
  ui.editing = false;
  ui.draft = null;
  ui.draftOriginal = '';
  ui.isNewRecipe = false;
  ui.isImport = false;
  ui.editorNotice = null;
}

/** Ask before throwing away unsaved edits. Returns true when it's OK to leave the editor. */
function confirmLeaveEditor() {
  if (!ui.editing) return true;
  if (draftDirty() && !confirm('You have unsaved changes to this recipe. Discard them?')) return false;
  stopEditing();
  return true;
}

function saveDraft() {
  const d = ui.draft;

  // FR-1: a recipe needs a name of 1–100 characters.
  const check = C.checkRecipeName(d);
  if (check.status !== 'ok') {
    if (check.status === 'filled') d.name = check.name;
    ui.editorNotice = { kind: check.status === 'filled' ? 'warn' : 'error', text: check.message, field: 'name' };
    ui.focusKey = 'recipe-name';
    render();
    window.scrollTo(0, 0);
    return false;
  }
  d.name = check.name;
  d.time = String(d.time || '').trim();

  let recipe = findRecipe(ui.recipeId);
  let before = null;
  if (ui.isNewRecipe || !recipe) {
    recipe = upgradeRecipe({ id: ui.recipeId, ...d, favorite: false });
    state.recipes.push(recipe);
  } else {
    before = editableCopy(recipe);
    Object.assign(recipe, editableCopy(d));
  }
  if (!save()) {
    // Undo, keep the user's edits in the form, and explain.
    if (before) Object.assign(recipe, before);
    else state.recipes = state.recipes.filter((r) => r !== recipe);
    toast('Couldn\'t save — browser storage is full. Try a smaller photo or delete an old recipe.');
    return false;
  }
  const wasNew = ui.isNewRecipe;
  stopEditing();
  render();
  window.scrollTo(0, 0);
  toast(wasNew ? `“${recipe.name}” added to your library` : 'Changes saved');
  return true;
}

function renderRecipeEditor(d) {
  const existing = findRecipe(ui.recipeId);
  const rows = d.ingredients.map((name) => {
    const amount = (d.amounts || {})[norm(name)] || '';
    return `
      <li>
        <span class="ing-name">${esc(name)}${amount ? ` <span class="ing-amount">${esc(amount)}</span>` : ''}</span>
        <span class="row-actions">
          <button class="icon-btn" data-action="remove-ingredient" data-name="${esc(name)}" title="Remove ingredient" aria-label="Remove ${esc(name)}">×</button>
        </span>
      </li>`;
  }).join('');

  const actions = `
      <button class="btn ghost" data-action="cancel-edit">Cancel</button>
      <button class="btn" data-action="save-edit">Save changes</button>`;

  return `
    <div class="toolbar editing-bar">
      <span class="editing-label">${ui.isNewRecipe ? (ui.isImport ? 'Review import' : 'New recipe') : 'Editing'}</span>
      <span class="toolbar-right">${actions}</span>
    </div>

    ${ui.editorNotice ? `<div class="notice ${ui.editorNotice.kind}" role="alert">${esc(ui.editorNotice.text)}</div>` : ''}

    ${renderPhotoPanel(d)}

    <section class="panel">
      <label class="field-label" for="recipe-name">Recipe name</label>
      <input type="text" id="recipe-name" class="title-input ${ui.editorNotice && ui.editorNotice.field === 'name' ? 'invalid' : ''}"
             data-bind="recipe-name" data-focus="recipe-name" maxlength="${C.NAME_MAX}" required
             value="${esc(d.name)}" placeholder="Name this dish (required)">
      <label class="field-label" for="recipe-time">Estimated time</label>
      <input type="text" id="recipe-time" class="time-input" data-bind="recipe-time" autocomplete="off"
             value="${esc(d.time || '')}" placeholder="e.g. 45 min or 1 hr 15 min">
      <label class="field-label" for="recipe-desc">Description</label>
      <textarea id="recipe-desc" data-bind="recipe-desc" data-autosize
                placeholder="What is it, any notes… (optional)">${esc(d.description)}</textarea>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h3>Ingredients <span class="sub">(${d.ingredients.length})</span></h3>
        <label class="switch">
          <input type="checkbox" data-action="toggle-fridge" ${d.useFridge ? 'checked' : ''}>
          Check against fridge
        </label>
      </div>
      <form class="inline-form" data-form="add-ingredient">
        <input type="text" name="item" data-focus="add-ingredient" autocomplete="off"
               placeholder="Add ingredient, e.g. 2 cups flour — separate several with commas">
        <button class="btn">Add</button>
      </form>
      ${d.ingredients.length ? `<ul class="ing-list">${rows}</ul>` : '<div class="empty">No ingredients yet.</div>'}
    </section>

    <section class="panel">
      <div class="panel-head"><h3>Directions</h3></div>
      <textarea id="recipe-directions" class="directions ${ui.editorNotice && ui.editorNotice.field === 'directions' ? 'invalid' : ''}" data-bind="recipe-directions" data-autosize
                aria-label="Directions"
                placeholder="1. Preheat the oven…&#10;2. Mix the dry ingredients…">${esc(d.directions)}</textarea>
      <p class="sub">Start lines with 1. 2. 3. to show them as numbered steps.</p>
    </section>

    <div class="edit-footer">
      ${existing && !ui.isNewRecipe ? '<button class="btn ghost danger" data-action="delete-recipe">Delete recipe</button>' : '<span></span>'}
      <span class="toolbar-right">${actions}</span>
    </div>`;
}

function renderPhotoPanel(r) {
  if (r.image) {
    return `
      <section class="panel photo-panel">
        <div class="panel-head">
          <h3>Photo</h3>
          <span class="row-actions">
            <label class="btn ghost small file-btn">Change photo
              <input type="file" accept="image/*" data-action="image-file" hidden>
            </label>
            <button class="btn ghost small danger" data-action="image-remove">Remove</button>
          </span>
        </div>
        <div class="photo-frame" data-dropzone>
          <img src="${esc(r.image)}" alt="${esc(r.name || 'Recipe')} — finished dish"
               onerror="this.closest('.photo-frame').classList.add('broken')">
          <span class="thumb-broken">${PHOTO_ICON}That image link couldn't load. Try another one.</span>
        </div>
      </section>`;
  }
  return `
    <section class="panel photo-panel">
      <div class="panel-head"><h3>Photo</h3><span class="sub">Show what the finished dish looks like</span></div>
      <label class="dropzone" data-dropzone data-focus="photo">
        <input type="file" accept="image/*" data-action="image-file" hidden>
        ${PHOTO_ICON}
        <strong>Choose a photo</strong>
        <span class="sub">or drag an image here</span>
      </label>
      <form class="inline-form photo-url" data-form="image-url">
        <input type="text" name="url" autocomplete="off" inputmode="url" placeholder="…or paste an image link (https://…)">
        <button class="btn ghost">Use link</button>
      </form>
    </section>`;
}

function renderFridge() {
  const items = [...state.fridge].sort((a, b) => a.localeCompare(b));
  const ready = sortedRecipes().filter((r) => r.useFridge && r.ingredients.length && !missingFor(r).length);

  return `
    <div class="view-head">
      <div>
        <h2>Fridge</h2>
        <p class="sub">${plural(items.length, 'item')} on hand</p>
      </div>
    </div>

    <section class="panel">
      <form class="inline-form" data-form="add-fridge">
        <input type="text" name="item" data-focus="add-fridge" autocomplete="off"
               placeholder="Add what you have — separate several with commas">
        <button class="btn">Add</button>
      </form>
      ${items.length
        ? `<ul class="chip-list">${items.map((n) => `
            <li class="chip">${esc(n)}
              <button class="icon-btn" data-action="fridge-remove" data-name="${esc(n)}" title="Used up" aria-label="Remove ${esc(n)}">×</button>
            </li>`).join('')}</ul>`
        : '<div class="empty">Your fridge is empty.</div>'}
    </section>

    <section class="panel">
      <div class="panel-head"><h3>Ready to cook</h3></div>
      ${ready.length
        ? `<ul class="ready-list">${ready.map((r) =>
            `<li><button data-action="open-recipe" data-id="${r.id}">${r.favorite ? '★ ' : ''}${esc(r.name || 'Untitled recipe')}</button></li>`).join('')}</ul>`
        : '<p class="sub">Nothing yet — every recipe is missing at least one ingredient.</p>'}
    </section>

    <div class="placeholder">
      <div class="ph-title">Scan fridge photo</div>
      Planned: take a photo of your fridge to update this list automatically. Not part of this demo.
    </div>`;
}

function renderLists() {
  const cards = state.lists.map((l) => {
    const checked = l.items.filter((i) => i.done).length;
    const items = l.items.map((it, idx) => `
      <li class="${it.done ? 'done' : ''}">
        <input type="checkbox" data-action="item-toggle" data-list="${l.id}" data-idx="${idx}" ${it.done ? 'checked' : ''}
               aria-label="Mark ${esc(it.name)} bought">
        <span class="item-name">${esc(it.name)}</span>
        <button class="icon-btn" data-action="item-remove" data-list="${l.id}" data-idx="${idx}" aria-label="Remove ${esc(it.name)}">×</button>
      </li>`).join('');

    return `
      <section class="panel list-card">
        <div class="panel-head">
          <input type="text" class="list-name" data-bind="list-name" data-list="${l.id}" value="${esc(l.name)}" aria-label="List name">
          <span class="tag">${l.items.length - checked} left</span>
        </div>
        <form class="inline-form" data-form="add-list-item" data-list="${l.id}">
          <input type="text" name="item" data-focus="list-${l.id}" autocomplete="off" placeholder="Add item">
          <button class="btn">Add</button>
        </form>
        ${l.items.length ? `<ul class="item-list">${items}</ul>` : '<p class="sub">Empty list.</p>'}
        <div class="list-actions">
          <button class="btn ghost small" data-action="list-to-fridge" data-list="${l.id}" ${checked ? '' : 'disabled'}>Move checked to fridge</button>
          <button class="btn ghost small" data-action="list-clear" data-list="${l.id}" ${checked ? '' : 'disabled'}>Clear checked</button>
          <button class="btn ghost small danger" data-action="list-delete" data-list="${l.id}">Delete list</button>
        </div>
      </section>`;
  }).join('');

  return `
    <div class="view-head">
      <div>
        <h2>Shopping Lists</h2>
        <p class="sub">${plural(state.lists.length, 'list')} · click a list's name to rename it</p>
      </div>
    </div>
    <form class="inline-form" data-form="new-list">
      <input type="text" name="name" data-focus="new-list" autocomplete="off" placeholder="New list name, e.g. Costco run">
      <button class="btn">+ New list</button>
    </form>
    ${state.lists.length
      ? `<div class="list-grid">${cards}</div>`
      : '<div class="empty">No shopping lists yet.</div>'}`;
}

function sourceLine(r) {
  if (!/^https?:\/\//.test(r.source)) return '';
  let host = r.source;
  try { host = new URL(r.source).hostname.replace(/^www\./, ''); } catch (e) { /* keep raw */ }
  return `<p class="source">Imported from <a href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">${esc(host)} ↗</a></p>`;
}

/** First web address inside shared text ("Check out this video! https://vm.tiktok.com/…"). */
function extractUrl(text) {
  const m = String(text || '').match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[.,;:!?)\]]+$/, '') : '';
}

function platformOf(url) {
  if (/tiktok\.com/i.test(url)) return 'TikTok';
  if (/instagram\.com|instagr\.am/i.test(url)) return 'Instagram';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'YouTube';
  return 'website';
}

/** Progress or error under a link form (shared by the Import tab and the Import window). */
function linkStatusBox() {
  const { status, message, caption } = ui.link;
  if (status === 'loading') {
    return `<div class="link-status loading" role="status"><span class="spinner" aria-hidden="true"></span>${esc(message)}</div>`;
  }
  if (status === 'error') {
    return `
      <div class="link-status error" role="alert">
        <p>${esc(message)}</p>
        ${caption ? '<button class="btn ghost small" data-action="caption-to-text">Edit the caption as text</button>' : ''}
      </div>`;
  }
  return '';
}

/** The link form: paste or drag a link in, then Scan. */
function linkForm() {
  const { status, url } = ui.link;
  const loading = status === 'loading';
  return `
      <form class="inline-form" data-form="import-link">
        <input type="text" name="url" inputmode="url" autocomplete="off" data-focus="link" aria-label="Recipe link"
               value="${esc(loading || status === 'error' ? url || '' : '')}"
               placeholder="Paste or drag a link here — https://…" ${loading ? 'disabled' : ''}>
        <button class="btn" ${loading ? 'disabled' : ''}>${loading ? 'Scanning…' : 'Scan'}</button>
      </form>`;
}

function renderLinkPanel() {
  const bookmarklet = `javascript:void(window.open('${location.origin}/?share-url='+encodeURIComponent(location.href)))`;
  const statusBox = linkStatusBox();

  if (!SERVER_MODE) {
    return `
      <section class="panel">
        <div class="panel-head"><h3>Link</h3><span class="tag">needs the server</span></div>
        <p class="sub" style="margin:0">
          Importing from a link needs the app's small server, because a page opened straight from a file isn't allowed
          to read other websites. On Windows, double-click the Cookbook desktop icon (set it up with <code>Install Cookbook.cmd</code>). Otherwise run <code>npm start</code> in this folder and open
          <code>http://localhost:3560</code>. Text import below works either way.
        </p>
      </section>`;
  }

  return `
    <section class="panel">
      <div class="panel-head"><h3>Link</h3><span class="tag have">new</span></div>
      <p class="sub" style="margin:0 0 12px">
        Paste a link to a recipe website, a TikTok, an Instagram post or Reel, or a YouTube video or Short.
        The app reads the recipe (or the video's caption/description) and opens it for you to check before it's saved.
      </p>
      ${linkForm()}
      <div class="platforms"><span class="tag">Recipe sites</span><span class="tag">TikTok</span><span class="tag">Instagram</span><span class="tag">YouTube &amp; Shorts</span></div>
      ${statusBox}
      <details class="desc share-help">
        <summary>Share straight from TikTok, Instagram or YouTube</summary>
        <div class="share-body">
          <p><strong>Android:</strong> open this app in Chrome and choose <em>Add to Home screen</em> (or <em>Install app</em>).
             Cookbook then shows up in the Share menu — tap <em>Share → Cookbook</em> on any video and it imports automatically.</p>
          <p><strong>iPhone:</strong> iOS doesn't let web apps join the Share menu yet. Tap <em>Share → Copy link</em>, then paste it above.</p>
          <p><strong>Computer:</strong> drag this button to your bookmarks bar, then click it on any recipe or video page:
             <a class="bookmarklet" href="${esc(bookmarklet)}" data-action="bookmarklet-hint">+ Cookbook</a></p>
        </div>
      </details>
    </section>`;
}

function renderImport() {
  return `
    <div class="view-head">
      <div>
        <h2>Import</h2>
        <p class="sub">Bring recipes in from elsewhere</p>
      </div>
    </div>

    ${renderLinkPanel()}

    <section class="panel">
      <div class="panel-head"><h3>Text</h3><span class="tag have">works in demo</span></div>
      <p class="sub" style="margin:0 0 12px">
        Copy a whole recipe page or a video caption and paste it here. The scanner skips the story, ads,
        hashtags and buttons, finds the recipe name, every ingredient with its amount, and the step-by-step
        directions. Check the result on the next screen — everything stays editable. Rule-based, no AI.
      </p>
      <form data-form="import-text">
        <textarea name="text" rows="12" data-bind="import-text" data-focus="import-text" placeholder="Paste a recipe article or caption here…

Garlic Butter Noodles
Quick weeknight dinner.

Ingredients
8 oz spaghetti
3 tbsp butter
4 cloves garlic, minced
Parmesan cheese, for serving

Instructions
1. Boil the pasta.
2. Melt the butter with the garlic, toss with the pasta and top with parmesan.">${esc(ui.importText)}</textarea>
        <div style="margin-top:10px"><button class="btn">Scan text</button></div>
      </form>
    </section>

    <section class="panel">
      <div class="panel-head"><h3>PDF</h3><span class="tag have">new</span></div>
      <p class="sub" style="margin:0 0 12px">
        A recipe saved as a PDF — a printed web page, a recipe card or a whole cookbook. The text is read on this
        computer, put back in reading order, scanned like pasted text and opened for you to check. If the PDF holds
        several recipes, you pick one.
      </p>
      <label class="dropzone compact" data-dropzone="pdf">
        <input type="file" accept="application/pdf,.pdf" data-action="import-pdf" hidden>
        ${PDF_ICON}<strong>Choose a PDF</strong><span class="sub">or drag it here</span>
      </label>
    </section>

    <section class="panel soon">
      <h3>Photo <span class="tag">planned</span></h3>
      <p class="sub">Scan a cookbook page and pull out the recipe text.</p>
    </section>`;
}

/* ---------------- pop-up windows ---------------- */

function modal(title, body, footer, label) {
  return `
    <div class="modal-backdrop" data-modal-backdrop>
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(label || title)}">
        <div class="modal-head">
          <h3>${title}</h3>
          <button class="icon-btn" data-action="modal-close" aria-label="Close">×</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>
    </div>`;
}

/** US-1: choose one or more shopping lists for the ingredients the recipe still needs. */
function renderListPicker() {
  const p = ui.listPicker;
  const rows = state.lists.map((l) => {
    const already = p.names.filter((n) => l.items.some((i) => !i.done && norm(i.name) === norm(n))).length;
    const willAdd = p.names.length - already;
    return `
      <label class="pick-row">
        <input type="checkbox" data-action="picker-list" value="${l.id}" ${p.selected.includes(l.id) ? 'checked' : ''}>
        <span class="pick-name">${esc(l.name)}</span>
        <span class="sub">${willAdd ? `adds ${plural(willAdd, 'item')}` : 'already has everything'}${already && willAdd ? ` · ${already} already on it` : ''}</span>
      </label>`;
  }).join('');
  const body = `
    <p class="sub" style="margin:0 0 10px">${p.names.length === 1
      ? `Add <strong>${esc(p.names[0])}</strong> to:`
      : `Adds ${plural(p.names.length, 'needed item')} (${esc(p.names.join(', '))}) to each list you pick. Items already on a list aren't added twice.`}</p>
    <div class="pick-list">
      ${rows}
      <label class="pick-row">
        <input type="checkbox" data-action="picker-new" ${p.newList ? 'checked' : ''}>
        <span class="pick-name">New list</span>
        <input type="text" class="pick-new-name" data-bind="picker-new-name" data-focus="picker-new-name" value="${esc(p.newName)}"
               placeholder="Name (optional)" aria-label="New list name" ${p.newList ? '' : 'disabled'}>
      </label>
    </div>`;
  const footer = `
    <button class="btn ghost" data-action="modal-close">Cancel</button>
    <button class="btn" data-action="picker-confirm">Add to ${p.selected.length + (p.newList ? 1 : 0) === 1 ? 'list' : 'lists'}</button>`;
  return modal('Add to List', body, footer);
}

/** US-2: the Import window on the library page. */
function renderImportDialog() {
  const { mode } = ui.importDialog;
  if (mode === 'url') {
    const body = SERVER_MODE ? `
      <p class="sub" style="margin:0 0 12px">Paste or drag in a link to a recipe page, a TikTok, an Instagram post or Reel,
        or a YouTube video. The recipe opens for you to check before it's saved.</p>
      ${linkForm()}
      ${linkStatusBox()}` : `
      <p class="sub" style="margin:0">Importing from a link needs the app's server. Start it with the Cookbook desktop icon
        or <code>npm start</code>, then open <code>http://localhost:3560</code>.</p>`;
    return modal('Import by URL', body, '<button class="btn ghost" data-action="import-mode" data-mode="menu">← Back</button>');
  }
  if (mode === 'text') {
    const body = `
      <form data-form="import-text">
        <textarea name="text" rows="10" data-bind="import-text" data-focus="import-text"
                  placeholder="Paste a recipe article or a video caption…">${esc(ui.importText)}</textarea>
        <div class="modal-inline-actions"><button class="btn">Scan text</button></div>
      </form>`;
    return modal('Import from text', body, '<button class="btn ghost" data-action="import-mode" data-mode="menu">← Back</button>');
  }
  const option = (action, title, desc, extra = '') => `
      <button class="import-option" data-action="${action}" ${extra}>
        <strong>${title}</strong><span class="sub">${desc}</span>
      </button>`;
  const body = `
    <div class="import-options">
      ${option('import-mode', 'Import by URL', 'A recipe website, TikTok, Instagram or YouTube link', 'data-mode="url"')}
      ${option('import-mode', 'Paste text', 'Type or paste a recipe or caption', 'data-mode="text"')}
      <label class="import-option" data-focus="import-file">
        <input type="file" accept=".txt,text/plain" data-action="import-file" hidden>
        <strong>Text file</strong><span class="sub">A .txt file from your computer</span>
      </label>
      <label class="import-option">
        <input type="file" accept="application/pdf,.pdf" data-action="import-pdf" hidden>
        <strong>PDF</strong><span class="sub">A recipe or cookbook saved as a PDF</span>
      </label>
      ${option('noop', 'Photo <span class="tag">planned</span>', 'Scan a photo of a cookbook page', 'disabled')}
    </div>`;
  return modal('Import a recipe', body, '');
}

function renderModal() {
  if (ui.busy) return renderBusy();
  if (ui.pdfPick) return renderPdfPick();
  if (ui.listPicker && ui.view === 'recipe' && !ui.editing) return renderListPicker();
  if (ui.importDialog && ui.view === 'library') return renderImportDialog();
  return '';
}

function closeModal() {
  if (ui.link.status === 'loading') return;   // the scan is still running
  if (ui.busy) return;                        // a file is still being read
  ui.pdfPick = null;
  ui.listPicker = null;
  ui.importDialog = null;
  if (ui.link.status === 'error') ui.link = { status: 'idle' };
  render();
}

/* ---------------- text import ---------------- */

function importRecipeText(text) {
  const parsed = window.RecipeParser.parseRecipe(text);
  if (!parsed) return null;
  return upgradeRecipe({ id: uid(), ...parsed, name: parsed.name.slice(0, C.NAME_MAX), favorite: false, useFridge: true });
}

const NO_DIRECTIONS_NOTICE = {
  kind: 'warn',
  field: 'directions',
  text: 'No directions were found — add the steps below, or save the recipe without them.',
};

/**
 * Use case step 5: an import opens the recipe form pre-filled. Nothing is added to the library
 * until the cook presses Save changes; Cancel leaves the library unchanged.
 */
function openImportedDraft(recipe, from = '') {
  if (!confirmLeaveEditor()) return false;
  ui.importDialog = null;
  ui.recipeId = recipe.id;
  startEditing(recipe, true, { imported: true, notice: recipe.directions.trim() ? null : NO_DIRECTIONS_NOTICE });
  ui.view = 'recipe';
  render();
  window.scrollTo(0, 0);
  const steps = recipe.directions.split('\n').filter((l) => /^\d+\. /.test(l)).length;
  toast(`Scanned${from ? ` from ${from}` : ''} · ${plural(recipe.ingredients.length, 'ingredient')} · ${plural(steps, 'step')} — check it, then Save changes`);
  return true;
}

/** Import → Text file: read a .txt file and scan it like pasted text. */
async function importTextFile(file) {
  if (!file) return;
  if (!/\.txt$/i.test(file.name) && file.type && !/^text\//.test(file.type)) {
    toast('Choose a plain text (.txt) file');
    return;
  }
  const recipe = importRecipeText(await file.text());
  if (!recipe || !recipe.ingredients.length) { toast('No recipe found in that file'); return; }
  openImportedDraft(recipe, file.name);
}

/* ---------------- PDF import ---------------- */

const PDF_MAX_BYTES = 30 * 1024 * 1024;
const NEEDS_SERVER = 'needs the app\'s server — open Cookbook from the desktop icon, or run npm start and go to http://localhost:3560';

/** "Reading cookbook.pdf…" with a progress bar, while a file is read. It can't be closed meanwhile. */
function renderBusy() {
  return modal(esc(ui.busy.title), `
    <div class="link-status loading" role="status">
      <span class="spinner" aria-hidden="true"></span><span data-busy-message>${esc(ui.busy.message)}</span>
      <progress max="1" value="0" data-busy-progress></progress>
    </div>`, '');
}

function setBusyProgress(fraction, message) {
  const bar = app.querySelector('[data-busy-progress]');
  const msg = app.querySelector('[data-busy-message]');
  if (bar) bar.value = fraction;
  if (msg && message) msg.textContent = message;
}

/** A cookbook PDF with several recipes: pick the one to import. */
function renderPdfPick() {
  const p = ui.pdfPick;
  const pages = (c) => (c.from === c.to ? `page ${c.from + 1}` : `pages ${c.from + 1}–${c.to + 1}`);
  const body = `
    <p class="sub" style="margin:0 0 10px">${esc(p.name)} has ${plural(p.choices.length, 'recipe')}. Which one do you want?</p>
    <div class="pick-list">${p.choices.map((c, i) => `
      <button class="pick-row pick-button" data-action="pdf-pick" data-index="${i}">
        <span class="pick-name">${esc(c.title || 'Untitled recipe')}</span><span class="sub">${pages(c)}</span>
      </button>`).join('')}
    </div>
    ${p.truncated ? `<p class="sub" style="margin:10px 0 0">Only the first ${p.readPages} of ${p.numPages} pages were searched.</p>` : ''}`;
  return modal('Pick a recipe', body, '<button class="btn ghost" data-action="modal-close">Cancel</button>');
}

/** Turn some of a PDF's pages into a draft recipe, or hand the text to Text import when there's no recipe in it. */
function importPdfPages(pdf, from, to, name) {
  const text = window.Scanner.joinPages(pdf.pages, from, to);
  const recipe = importRecipeText(text);
  if (recipe && recipe.ingredients.length) {
    if (!openImportedDraft(recipe, name)) render();
    return;
  }
  ui.importText = text;
  ui.view = 'import';
  ui.focusKey = 'import-text';
  render();
  toast('No ingredient list found in that PDF — its text is in Text import below to fix up');
}

async function importPdf(file) {
  if (!file) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { toast('Choose a PDF file'); return; }
  if (file.size > PDF_MAX_BYTES) { toast('That PDF is over 30 MB — save just the recipe pages as a new PDF'); return; }
  if (!SERVER_MODE) { toast(`Reading a PDF ${NEEDS_SERVER}`); return; }
  if (!confirmLeaveEditor()) return;
  ui.importDialog = null;
  ui.busy = { title: `Reading ${file.name}`, message: 'Reading the PDF…' };
  render();

  let pdf;
  try {
    pdf = await window.Scanner.readPdf(file, (f) => setBusyProgress(f, `Reading the PDF… ${Math.round(f * 100)}%`));
  } catch (e) {
    ui.busy = null;
    render();
    toast(e.code === 'password' ? 'That PDF is password-protected — open it, save an unlocked copy, and try again'
      : e.code === 'unreadable' ? 'Couldn\'t open that PDF — the file may be damaged'
        : 'The PDF reader couldn\'t start — reload the page and try again');
    return;
  }
  ui.busy = null;

  const textChars = pdf.pageTexts.join('').replace(/\s/g, '').length;
  if (textChars < 40) {
    render();
    toast('That PDF is a picture of a page, with no text inside to read');
    return;
  }
  if (pdf.recipes.length > 1) {
    ui.pdfPick = {
      name: file.name,
      pdf,
      numPages: pdf.numPages,
      readPages: pdf.readPages,
      truncated: pdf.readPages < pdf.numPages,
      choices: pdf.recipes.map((r) => {
        const parsed = window.RecipeParser.parseRecipe(window.Scanner.joinPages(pdf.pages, r.from, r.to));
        return { ...r, title: parsed ? parsed.name : '' };
      }),
    };
    render();
    return;
  }
  const one = pdf.recipes[0];
  // One recipe: its pages. No "Ingredients" heading at all: the first few pages, scanned as they are.
  importPdfPages(pdf, one ? one.from : 0, one ? one.to : Math.min(pdf.pages.length, 6) - 1, file.name);
}

/* ---------------- recipe photos ---------------- */

const PHOTO_MAX_SIDE = 1000;   // px — big enough for the recipe page, small enough for localStorage
const PHOTO_QUALITY = 0.82;

/** Shrink a chosen photo and turn it into a JPEG data URL that can be saved with the recipe. */
function photoToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('not-image')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1f1f23';                       // transparent PNGs get the panel color
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', PHOTO_QUALITY));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    img.src = url;
  });
}

/** Photos are part of the edit form: they're saved with the rest of the recipe on Save. */
function setDraftImage(image, message) {
  if (!ui.editing || !ui.draft) return;
  ui.draft.image = image;
  if (message) toast(message);
  render();
}

async function addPhotoFile(file) {
  if (!ui.editing || !file) return;
  try {
    setDraftImage(await photoToDataUrl(file), 'Photo added — remember to save');
  } catch (e) {
    toast(e.message === 'not-image'
      ? 'That file isn\'t an image'
      : 'Couldn\'t read that image — try a JPG or PNG');
  }
}

/* ---------------- link import ---------------- */

async function importLink(rawUrl) {
  // Use case step 2 / alternate 2a: only a full http(s) link is sent to the server.
  const url = extractUrl(rawUrl);
  if (!url) {
    ui.link = { status: 'error', code: 'invalid-link', message: 'Enter a full link starting with http', url: rawUrl };
    render();
    return;
  }
  const where = platformOf(url);
  ui.link = {
    status: 'loading',
    url,
    message: where === 'website' ? 'Reading the recipe page…' : `Reading the ${where} ${where === 'YouTube' ? 'description' : 'caption'}…`,
  };
  if (ui.view === 'import' || ui.importDialog) render();

  let data;
  try {
    const res = await fetch(`/api/import?url=${encodeURIComponent(url)}`);
    data = await res.json();
  } catch (e) {
    data = { ok: false, error: 'Couldn\'t reach the Cookbook server. Is it still running (npm start)?' };
  }
  if (!data.ok) {
    // Alternates 3a / 4a: say what went wrong; nothing is saved.
    ui.link = { status: 'error', code: data.code || '', url, message: data.error, caption: data.caption || '' };
    if (!ui.importDialog && ui.view !== 'recipe') ui.view = 'import';
    render();
    return;
  }

  const r = data.recipe;
  const recipe = upgradeRecipe({ id: uid(), ...r, name: String(r.name || '').slice(0, C.NAME_MAX), image: '', favorite: false, useFridge: true });

  // The server sends the dish photo along; shrink it like any other photo. It's saved with the recipe on Save.
  if (r.image) {
    try {
      const blob = await (await fetch(r.image)).blob();
      recipe.image = await photoToDataUrl(blob);
    } catch (e) {
      recipe.image = /^https:\/\//.test(r.image) ? r.image : '';
    }
  }

  ui.link = { status: 'idle' };
  openImportedDraft(recipe, where === 'website' ? 'the web' : where);
}

/** Links shared into the installed app (Android Share menu) or sent by the bookmarklet. */
function handleSharedLink() {
  const q = new URLSearchParams(location.search);
  if (!['share-url', 'share-text', 'share-title'].some((k) => q.has(k))) return;
  const shared = ['share-url', 'share-text', 'share-title'].map((k) => q.get(k) || '').join(' ');
  history.replaceState(null, '', location.pathname);
  ui.view = 'import';
  const url = extractUrl(shared);
  if (url && SERVER_MODE) {
    importLink(url);
  } else {
    ui.importText = shared.trim();
    render();
    toast('Shared text added to Text import — tap Scan text');
  }
}

/* ---------------- toast ---------------- */

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------------- events ---------------- */

function go(view) {
  if (!confirmLeaveEditor()) return false;
  ui.listPicker = null;
  ui.importDialog = null;
  ui.view = view;
  render();
  window.scrollTo(0, 0);
  return true;
}

function openRecipe(id, { edit = false } = {}) {
  if (!confirmLeaveEditor()) return false;
  ui.listPicker = null;
  ui.importDialog = null;
  ui.recipeId = id;
  const r = findRecipe(id);
  if (edit && r) startEditing(r);
  ui.view = 'recipe';
  render();
  window.scrollTo(0, 0);
  return true;
}

// Closing the window or reloading with unsaved edits asks first.
window.addEventListener('beforeunload', (e) => {
  if (draftDirty()) { e.preventDefault(); e.returnValue = ''; }
});

document.addEventListener('click', (e) => {
  // Clicking the dimmed area around a pop-up window closes it.
  if (e.target.matches && e.target.matches('[data-modal-backdrop]')) { closeModal(); return; }
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'file') return;
  const { action } = el.dataset;
  const recipe = findRecipe(ui.recipeId);

  switch (action) {
    case 'nav':
      go(el.dataset.view);
      break;

    case 'new-recipe': {
      if (!confirmLeaveEditor()) break;
      const r = upgradeRecipe({ id: uid(), name: '' });
      ui.recipeId = r.id;
      startEditing(r, true);          // not in the library until it's saved
      ui.view = 'recipe';
      ui.focusKey = 'recipe-name';
      render();
      window.scrollTo(0, 0);
      break;
    }

    case 'open-recipe': {
      const toPhoto = el.dataset.then === 'photo';
      if (!openRecipe(el.dataset.id, { edit: toPhoto })) break;
      if (toPhoto) {
        const zone = app.querySelector('.dropzone');
        if (zone) { zone.scrollIntoView({ block: 'center' }); zone.classList.add('pulse'); }
      }
      break;
    }

    case 'edit-recipe':
      if (recipe) {
        startEditing(recipe);
        render();
        window.scrollTo(0, 0);
      }
      break;

    case 'save-edit':
      saveDraft();
      break;

    case 'cancel-edit': {
      const wasNew = ui.isNewRecipe;
      if (!confirmLeaveEditor()) break;
      if (wasNew) { go('library'); break; }
      render();
      window.scrollTo(0, 0);
      break;
    }

    case 'filter-scope':
      ui.filter.scope = el.dataset.scope;
      render();
      break;

    case 'filter-toggle': {
      const key = el.dataset.key;
      ui.filter[key] = !ui.filter[key];
      // "Can make now" and "Missing ingredients" can't both be on.
      if (ui.filter[key] && key === 'canMake') ui.filter.missing = false;
      if (ui.filter[key] && key === 'missing') ui.filter.canMake = false;
      render();
      break;
    }

    case 'filter-clear':
      ui.filter = NO_FILTERS();
      render();
      break;

    case 'caption-to-text':
      ui.importText = ui.link.caption || '';
      ui.link = { status: 'idle' };
      if (ui.importDialog) ui.importDialog = { mode: 'text' };
      ui.focusKey = 'import-text';
      render();
      break;

    case 'bookmarklet-hint':
      e.preventDefault();
      toast('Drag this button to your bookmarks bar instead of clicking it');
      break;

    case 'image-remove':
      if (ui.editing && confirm('Remove this photo?')) setDraftImage('', 'Photo removed — remember to save');
      break;

    case 'toggle-favorite': {
      const r = findRecipe(el.dataset.id);
      if (!r) break;
      r.favorite = !r.favorite;
      save();
      render();
      toast(r.favorite ? `★ “${r.name || 'Recipe'}” pinned to the top` : 'Removed from favorites');
      break;
    }

    case 'delete-recipe':
      if (recipe && confirm(`Delete “${recipe.name || 'this recipe'}”? This can't be undone.`)) {
        stopEditing();
        state.recipes = state.recipes.filter((r) => r.id !== recipe.id);
        save();
        go('library');
        toast('Recipe deleted');
      }
      break;

    case 'remove-ingredient': {
      const d = ui.draft;
      if (!ui.editing || !d) break;
      const i = d.ingredients.findIndex((n) => norm(n) === norm(el.dataset.name));
      if (i > -1) d.ingredients.splice(i, 1);
      delete d.amounts[norm(el.dataset.name)];
      render();
      break;
    }

    case 'ingredient-to-fridge':
      addToFridge([el.dataset.name]);
      save();
      render();
      toast(`${el.dataset.name} added to fridge`);
      break;

    case 'add-missing-one':
      openListPicker([el.dataset.name]);
      break;

    case 'add-missing-all':
      if (recipe) openListPicker(missingFor(recipe));
      break;

    case 'picker-confirm':
      confirmListPicker(recipe);
      break;

    case 'modal-close':
      closeModal();
      break;

    case 'import-open':
      ui.importDialog = { mode: 'menu' };
      if (ui.link.status === 'error') ui.link = { status: 'idle' };
      render();
      break;

    case 'import-mode':
      ui.importDialog = { mode: el.dataset.mode };
      if (ui.link.status === 'error') ui.link = { status: 'idle' };
      ui.focusKey = el.dataset.mode === 'url' ? 'link' : el.dataset.mode === 'text' ? 'import-text' : null;
      render();
      break;

    case 'fridge-remove':
      state.fridge = state.fridge.filter((n) => norm(n) !== norm(el.dataset.name));
      save();
      render();
      break;

    case 'item-remove': {
      const list = findList(el.dataset.list);
      list.items.splice(Number(el.dataset.idx), 1);
      save();
      render();
      break;
    }

    case 'list-to-fridge': {
      const list = findList(el.dataset.list);
      const bought = list.items.filter((i) => i.done).map((i) => i.name);
      const added = addToFridge(bought);
      list.items = list.items.filter((i) => !i.done);
      save();
      render();
      toast(`Moved ${plural(added, 'item')} to the fridge`);
      break;
    }

    case 'list-clear': {
      const list = findList(el.dataset.list);
      list.items = list.items.filter((i) => !i.done);
      save();
      render();
      break;
    }

    case 'list-delete': {
      const list = findList(el.dataset.list);
      if (confirm(`Delete the list “${list.name}”?`)) {
        state.lists = state.lists.filter((l) => l.id !== list.id);
        save();
        render();
      }
      break;
    }

    case 'pdf-pick': {
      const p = ui.pdfPick;
      const c = p && p.choices[Number(el.dataset.index)];
      if (!c) break;
      ui.pdfPick = null;
      importPdfPages(p.pdf, c.from, c.to, p.name);
      break;
    }

    case 'reset-demo':
      if (confirm('Reset all demo data? Your recipes, fridge and lists will be replaced with the sample data.')) {
        stopEditing();
        state = seedData();
        save();
        ui.recipeId = null;
        go('library');
        toast('Demo data reset');
      }
      break;

    default:
      break;
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  const { action } = el.dataset;
  if (!action) return;
  const recipe = findRecipe(ui.recipeId);

  if (action === 'toggle-fridge' && ui.editing && ui.draft) {
    ui.draft.useFridge = el.checked;
  } else if (action === 'image-file') {
    addPhotoFile(el.files && el.files[0]);
  } else if (action === 'import-file') {
    importTextFile(el.files && el.files[0]);
  } else if (action === 'import-pdf') {
    importPdf(el.files && el.files[0]);
    el.value = '';           // choosing the same file again still imports it
  } else if (action === 'filter-time') {
    ui.filter.maxTime = Number(el.value) || 0;
    render();
  } else if (action === 'picker-list' && ui.listPicker) {
    const sel = ui.listPicker.selected.filter((id) => id !== el.value);
    if (el.checked) sel.push(el.value);
    ui.listPicker.selected = sel;
    render();
  } else if (action === 'picker-new' && ui.listPicker) {
    ui.listPicker.newList = el.checked;
    ui.focusKey = el.checked ? 'picker-new-name' : null;
    render();
  } else if (action === 'item-toggle') {
    const list = findList(el.dataset.list);
    list.items[Number(el.dataset.idx)].done = el.checked;
    save();
    render();
  }
});

/* Text fields save as you type without re-rendering (keeps cursor position). */
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.filter === 'q') {
    // Update only the results so the search box keeps focus while typing.
    ui.filter.q = el.value;
    const box = document.getElementById('library-results');
    if (box) box.innerHTML = renderLibraryResults();
    return;
  }
  const { bind } = el.dataset;
  if (!bind) return;
  if (el.matches('textarea[data-autosize]')) autosize(el);

  // Recipe fields change the draft only; they're written to the recipe on Save.
  const d = ui.editing ? ui.draft : null;
  if (bind === 'recipe-name') {
    if (d) d.name = el.value;
    if (el.value.trim()) el.classList.remove('invalid');
    return;
  }
  if (bind === 'recipe-time') { if (d) d.time = el.value; return; }
  if (bind === 'recipe-desc') { if (d) d.description = el.value; return; }
  if (bind === 'recipe-directions') { if (d) d.directions = el.value; return; }
  if (bind === 'import-text') { ui.importText = el.value; return; }
  if (bind === 'picker-new-name') { if (ui.listPicker) ui.listPicker.newName = el.value; return; }
  else if (bind === 'list-name') findList(el.dataset.list).name = el.value;
  save();
});

/* Re-render list dropdowns etc. once a list rename is finished. */
document.addEventListener('focusout', (e) => {
  const el = e.target;
  if (el.dataset && el.dataset.bind === 'list-name' && !el.value.trim()) {
    findList(el.dataset.list).name = 'Untitled list';
    save();
    render();
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const kind = form.dataset.form;
  const field = form.querySelector('input, textarea');
  const value = field.value;

  switch (kind) {
    case 'add-ingredient': {
      const d = ui.draft;
      if (!ui.editing || !d) return;
      splitItems(value).forEach((item) => {
        // "2 cups flour" → Flour, with "2 cups" kept as its amount.
        const parsed = window.RecipeParser ? window.RecipeParser.parseIngredientLine(item) : [];
        const entries = parsed.length ? parsed : [{ name: item, amount: '' }];
        entries.forEach(({ name, amount }) => {
          if (!d.ingredients.some((x) => norm(x) === norm(name))) d.ingredients.push(name);
          if (amount) d.amounts[norm(name)] = amount;
        });
      });
      ui.focusKey = 'add-ingredient';
      render();
      return;
    }

    case 'add-fridge':
      addToFridge(splitItems(value));
      ui.focusKey = 'add-fridge';
      break;

    case 'new-list': {
      const name = value.trim() || `List ${state.lists.length + 1}`;
      const list = { id: uid(), name, items: [] };
      state.lists.push(list);
      ui.focusKey = `list-${list.id}`;
      break;
    }

    case 'add-list-item': {
      const list = findList(form.dataset.list);
      splitItems(value).forEach((n) => list.items.push({ name: n, done: false }));
      ui.focusKey = `list-${list.id}`;
      break;
    }

    case 'import-link':
      importLink(value);
      return;

    case 'image-url': {
      const url = value.trim();
      if (!/^https?:\/\/\S+$/i.test(url)) { toast('Paste a full image link starting with https://'); return; }
      setDraftImage(url, 'Photo added — remember to save');
      return;
    }

    case 'import-text': {
      const recipe = importRecipeText(value);
      if (!recipe) { toast('Paste some recipe text first'); return; }
      if (openImportedDraft(recipe)) ui.importText = '';
      return;
    }

    default:
      return;
  }

  save();
  render();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (ui.listPicker || ui.importDialog || ui.pdfPick)) { closeModal(); return; }
  if (e.key === 'Escape' && e.target.dataset && e.target.dataset.filter === 'q' && e.target.value) {
    e.target.value = '';
    e.target.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // Ctrl/Cmd+S saves while editing a recipe.
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && ui.editing) {
    e.preventDefault();
    saveDraft();
  }
});

/* Drag a photo onto the recipe's photo area. */
['dragenter', 'dragover'].forEach((type) => document.addEventListener(type, (e) => {
  const zone = e.target.closest && e.target.closest('[data-dropzone]');
  if (!zone) return;
  e.preventDefault();
  zone.classList.add('dragging');
}));
document.addEventListener('dragleave', (e) => {
  const zone = e.target.closest && e.target.closest('[data-dropzone]');
  if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('dragging');
});
document.addEventListener('drop', (e) => {
  const zone = e.target.closest && e.target.closest('[data-dropzone]');
  if (!zone) return;
  e.preventDefault();
  zone.classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (zone.dataset.dropzone === 'pdf') importPdf(file);
  else if (ui.editing) addPhotoFile(file);
});

render();
handleSharedLink();

// Tell the server this window is open, so the desktop launcher's server knows when to stop.
if (SERVER_MODE && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  const ping = () => fetch('/api/ping', { cache: 'no-store' }).catch(() => {});
  ping();
  setInterval(ping, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); });
  window.addEventListener('pagehide', () => { try { navigator.sendBeacon('/api/bye'); } catch (e) { /* ignore */ } });
}

// Lets the app be installed to the home screen (and receive shared links on Android).
if (SERVER_MODE && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => { /* optional */ });
}
