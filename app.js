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
        favorite: true,
        useFridge: true,
      },
      {
        id: uid(),
        name: 'Pancakes',
        description: 'Fluffy weekend pancakes.',
        ingredients: ['Flour', 'Sugar', 'Eggs', 'Milk', 'Butter', 'Baking powder'],
        amounts: { flour: '1 1/2 cups', sugar: '2 tbsp', eggs: '1', milk: '1 1/4 cups', butter: '3 tbsp, melted', 'baking powder': '1 tbsp' },
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
  targetListId: null,
  focusKey: null,
  link: { status: 'idle' },   // link import: idle | loading | error
  importText: '',
};

/* Link import needs server.js; opened as a plain file it can't fetch other sites. */
const SERVER_MODE = /^https?:$/.test(location.protocol);

/* ---------------- domain logic ---------------- */

const findRecipe = (id) => state.recipes.find((r) => r.id === id);
const findList = (id) => state.lists.find((l) => l.id === id);
const inFridge = (name) => state.fridge.some((f) => norm(f) === norm(name));
const amountOf = (recipe, name) => (recipe.amounts || {})[norm(name)] || '';

/** Library order: favorites first, otherwise the order recipes were added. */
const sortedRecipes = () => [
  ...state.recipes.filter((r) => r.favorite),
  ...state.recipes.filter((r) => !r.favorite),
];

const STAR_PATH = 'M12 2.8l2.82 5.72 6.31.92-4.57 4.45 1.08 6.29L12 17.21l-5.64 2.97 1.08-6.29L2.87 9.44l6.31-.92z';
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

/** Ingredients for display: missing first (when fridge check is on). */
function orderedIngredients(recipe) {
  if (!recipe.useFridge) return recipe.ingredients.map((name) => ({ name, missing: false }));
  const missing = [];
  const have = [];
  recipe.ingredients.forEach((name) => {
    (inFridge(name) ? have : missing).push({ name, missing: !inFridge(name) });
  });
  return [...missing, ...have];
}

function missingFor(recipe) {
  return recipe.useFridge ? recipe.ingredients.filter((n) => !inFridge(n)) : [];
}

/** Names of lists that already have this item (not yet checked off). */
function listsContaining(name) {
  return state.lists
    .filter((l) => l.items.some((i) => !i.done && norm(i.name) === norm(name)))
    .map((l) => l.name);
}

function addToFridge(names) {
  let added = 0;
  names.forEach((n) => {
    if (!inFridge(n)) { state.fridge.push(n); added++; }
  });
  return added;
}

function addToList(listId, names, recipe) {
  let list = findList(listId);
  if (!list) {
    list = { id: uid(), name: recipe ? `For ${recipe.name || 'recipe'}` : 'New list', items: [] };
    state.lists.push(list);
    ui.targetListId = list.id;
  }
  let added = 0;
  names.forEach((n) => {
    if (!list.items.some((i) => !i.done && norm(i.name) === norm(n))) {
      list.items.push({ name: n, done: false });
      added++;
    }
  });
  save();
  toast(added
    ? `Added ${plural(added, 'item')} to “${list.name}”`
    : `Already on “${list.name}”`);
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
  app.innerHTML = (views[ui.view] || renderLibrary)();

  app.querySelectorAll('textarea[data-autosize]').forEach(autosize);

  if (ui.focusKey) {
    const el = app.querySelector(`[data-focus="${ui.focusKey}"]`);
    if (el) el.focus();
    ui.focusKey = null;
  }
}

/** Grow a textarea to fit its text so imported directions are readable without scrolling. */
function autosize(el) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight + 2, 900)}px`;
}

function renderLibrary() {
  const favCount = state.recipes.filter((r) => r.favorite).length;
  const cards = sortedRecipes().map((r) => {
    const ings = orderedIngredients(r);
    const missing = ings.filter((i) => i.missing).length;
    let status = '';
    if (!r.useFridge) status = '<span class="tag">fridge check off</span>';
    else if (!r.ingredients.length) status = '<span class="tag">no ingredients</span>';
    else if (missing) status = `<span class="tag need">${missing} missing</span>`;
    else status = '<span class="tag have">ready to cook</span>';

    return `
      <article class="recipe-card ${r.favorite ? 'fav' : ''}">
        <div class="card-top">
          <h3>${esc(r.name || 'Untitled recipe')}</h3>
          <button class="btn ghost small" data-action="open-recipe" data-id="${r.id}">Open</button>
        </div>
        ${recipeThumb(r)}
        <div class="card-meta">${status}<span class="tag">${plural(r.ingredients.length, 'ingredient')}</span></div>
        <details class="desc">
          <summary>Description</summary>
          ${r.description.trim()
            ? `<p>${esc(r.description)}</p>`
            : '<p class="none">No description yet.</p>'}
        </details>
        <details class="desc">
          <summary>Directions</summary>
          ${r.directions.trim()
            ? `<p>${esc(r.directions)}</p>`
            : '<p class="none">No directions yet.</p>'}
        </details>
        ${ings.length
          ? `<ul class="mini-ings">${ings.map((i) =>
              `<li class="${i.missing ? 'missing' : ''}">${esc(i.name)}</li>`).join('')}</ul>`
          : ''}
      </article>`;
  }).join('');

  return `
    <div class="view-head">
      <div>
        <h2>Recipe Library</h2>
        <p class="sub">${plural(state.recipes.length, 'recipe')}${favCount ? ` · ${favCount} ★ favorite${favCount === 1 ? '' : 's'} pinned to the top` : ''} · red ingredients aren't in your fridge</p>
      </div>
      <button class="btn" data-action="new-recipe">+ New recipe</button>
    </div>
    ${state.recipes.length
      ? `<div class="recipe-grid">${cards}</div>`
      : '<div class="empty">Your library is empty. Create your first recipe.</div>'}`;
}

function listOptions(selected) {
  const opts = state.lists.map((l) =>
    `<option value="${l.id}" ${l.id === selected ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
  return `${opts}<option value="__new" ${selected === '__new' ? 'selected' : ''}>+ New list…</option>`;
}

function renderRecipe() {
  const r = findRecipe(ui.recipeId);
  if (!r) { ui.view = 'library'; return renderLibrary(); }

  if (!findList(ui.targetListId)) ui.targetListId = state.lists[0] ? state.lists[0].id : '__new';

  const ings = orderedIngredients(r);
  const missing = ings.filter((i) => i.missing);

  const rows = ings.map((i) => {
    const onLists = i.missing ? listsContaining(i.name) : [];
    let tag = '';
    if (r.useFridge) tag = i.missing ? '<span class="tag need">need</span>' : '<span class="tag have">have</span>';
    const listTag = onLists.length ? `<span class="tag info">on ${esc(onLists.join(', '))}</span>` : '';
    const actions = i.missing ? `
        <button class="btn ghost small" data-action="add-missing-one" data-name="${esc(i.name)}" title="Add to the selected list">+ List</button>
        <button class="btn ghost small" data-action="ingredient-to-fridge" data-name="${esc(i.name)}" title="I have this now">Got it</button>` : '';
    return `
      <li class="${i.missing ? 'missing' : ''}">
        <span class="ing-name">${esc(i.name)}${amountOf(r, i.name)
          ? ` <span class="ing-amount">${esc(amountOf(r, i.name))}</span>` : ''}</span>
        ${tag}${listTag}
        <span class="row-actions">
          ${actions}
          <button class="icon-btn" data-action="remove-ingredient" data-name="${esc(i.name)}" title="Remove ingredient" aria-label="Remove ${esc(i.name)}">×</button>
        </span>
      </li>`;
  }).join('');

  const missingBar = missing.length ? `
    <div class="missing-bar">
      <strong>${missing.length} missing</strong>
      <span class="spacer"></span>
      <span>Add to</span>
      <select data-action="target-list" aria-label="Target list">${listOptions(ui.targetListId)}</select>
      <button class="btn small" data-action="add-missing-all">Add all missing</button>
    </div>` : '';

  return `
    <div class="toolbar">
      <button class="btn ghost" data-action="nav" data-view="library">← Library</button>
      <span class="toolbar-right">
        ${starButton(r, 'large')}
        <button class="btn ghost danger" data-action="delete-recipe">Delete recipe</button>
      </span>
    </div>

    ${renderPhotoPanel(r)}

    <section class="panel">
      <label class="field-label" for="recipe-name">Recipe name</label>
      <input type="text" id="recipe-name" class="title-input" data-bind="recipe-name"
             value="${esc(r.name)}" placeholder="Name this dish">
      ${sourceLine(r)}
      <label class="field-label" for="recipe-desc">Description</label>
      <textarea id="recipe-desc" data-bind="recipe-desc" data-autosize
                placeholder="What is it, how do you make it, any notes…">${esc(r.description)}</textarea>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h3>Ingredients <span class="sub">(${r.ingredients.length})</span></h3>
        <label class="switch">
          <input type="checkbox" data-action="toggle-fridge" ${r.useFridge ? 'checked' : ''}>
          Check against fridge
        </label>
      </div>
      <form class="inline-form" data-form="add-ingredient">
        <input type="text" name="item" data-focus="add-ingredient" autocomplete="off"
               placeholder="Add ingredient — separate several with commas">
        <button class="btn">Add</button>
      </form>
      ${missingBar}
      ${ings.length ? `<ul class="ing-list">${rows}</ul>` : '<div class="empty">No ingredients yet.</div>'}
    </section>

    <section class="panel">
      <div class="panel-head"><h3>Directions</h3></div>
      <textarea id="recipe-directions" class="directions" data-bind="recipe-directions" data-autosize
                aria-label="Directions"
                placeholder="1. Preheat the oven…&#10;2. Mix the dry ingredients…">${esc(r.directions)}</textarea>
    </section>`;
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

function renderLinkPanel() {
  const { status, message, caption, url } = ui.link;
  const loading = status === 'loading';
  const bookmarklet = `javascript:void(window.open('${location.origin}/?share-url='+encodeURIComponent(location.href)))`;

  let statusBox = '';
  if (loading) {
    statusBox = `<div class="link-status loading" role="status"><span class="spinner" aria-hidden="true"></span>${esc(message)}</div>`;
  } else if (status === 'error') {
    statusBox = `
      <div class="link-status error" role="alert">
        <p>${esc(message)}</p>
        ${caption ? '<button class="btn ghost small" data-action="caption-to-text">Edit the caption in Text import ↓</button>' : ''}
      </div>`;
  }

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
        The app reads the recipe (or the video's caption/description) and imports it.
      </p>
      <form class="inline-form" data-form="import-link">
        <input type="text" name="url" inputmode="url" autocomplete="off" data-focus="link"
               value="${esc(loading || status === 'error' ? url || '' : '')}"
               placeholder="https://www.tiktok.com/@chef/video/…" ${loading ? 'disabled' : ''}>
        <button class="btn" ${loading ? 'disabled' : ''}>${loading ? 'Reading…' : 'Import'}</button>
      </form>
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

    <section class="panel soon">
      <h3>Photo <span class="tag">planned</span></h3>
      <p class="sub">Scan a cookbook page and pull out the recipe text.</p>
    </section>`;
}

/* ---------------- text import ---------------- */

function importRecipeText(text) {
  const parsed = window.RecipeParser.parseRecipe(text);
  if (!parsed) return null;
  return upgradeRecipe({ id: uid(), ...parsed, favorite: false, useFridge: true });
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

function setRecipeImage(recipe, image, message) {
  const previous = recipe.image;
  recipe.image = image;
  if (!save()) {
    recipe.image = previous;
    save();
    toast('Browser storage is full — remove a photo from another recipe and try again');
  } else if (message) {
    toast(message);
  }
  render();
}

async function addPhotoFile(file) {
  const recipe = findRecipe(ui.recipeId);
  if (!recipe || !file) return;
  try {
    setRecipeImage(recipe, await photoToDataUrl(file), 'Photo added');
  } catch (e) {
    toast(e.message === 'not-image'
      ? 'That file isn\'t an image'
      : 'Couldn\'t read that image — try a JPG or PNG');
  }
}

/* ---------------- link import ---------------- */

async function importLink(rawUrl) {
  const url = extractUrl(rawUrl) || (/^[\w-]+(\.[\w-]+)+\//.test(rawUrl.trim()) ? `https://${rawUrl.trim()}` : '');
  if (!url) {
    ui.link = { status: 'error', message: 'Paste a full link, starting with https://', url: rawUrl };
    render();
    return;
  }
  const where = platformOf(url);
  ui.link = {
    status: 'loading',
    url,
    message: where === 'website' ? 'Reading the recipe page…' : `Reading the ${where} ${where === 'YouTube' ? 'description' : 'caption'}…`,
  };
  if (ui.view === 'import') render();

  let data;
  try {
    const res = await fetch(`/api/import?url=${encodeURIComponent(url)}`);
    data = await res.json();
  } catch (e) {
    data = { ok: false, error: 'Couldn\'t reach the Cookbook server. Is it still running (npm start)?' };
  }
  if (!data.ok) {
    ui.link = { status: 'error', url, message: data.error, caption: data.caption || '' };
    ui.view = 'import';
    render();
    return;
  }

  const recipe = upgradeRecipe({ id: uid(), ...data.recipe, image: '', favorite: false, useFridge: true });
  state.recipes.push(recipe);
  if (!save()) {
    state.recipes.pop();
    ui.link = { status: 'error', url, message: 'Browser storage is full — delete a recipe or a photo and try again.' };
    render();
    return;
  }

  // The server sends the dish photo along; shrink it like any other photo before saving.
  if (data.recipe.image) {
    let photo = '';
    try {
      const blob = await (await fetch(data.recipe.image)).blob();
      photo = await photoToDataUrl(blob);
    } catch (e) {
      photo = /^https:\/\//.test(data.recipe.image) ? data.recipe.image : '';
    }
    if (photo) {
      recipe.image = photo;
      if (!save()) { recipe.image = ''; save(); }
    }
  }

  ui.link = { status: 'idle' };
  ui.recipeId = recipe.id;
  go('recipe');
  const steps = recipe.directions.split('\n').filter((l) => /^\d+\. /.test(l)).length;
  toast(`Imported “${recipe.name}” from ${where === 'website' ? 'the web' : where} · ${plural(recipe.ingredients.length, 'ingredient')} · ${plural(steps, 'step')}`);
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
  ui.view = view;
  render();
  window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'SELECT' || el.type === 'checkbox') return;
  const { action } = el.dataset;
  const recipe = findRecipe(ui.recipeId);

  switch (action) {
    case 'nav':
      go(el.dataset.view);
      break;

    case 'new-recipe': {
      const r = upgradeRecipe({ id: uid(), name: `Recipe ${state.recipes.length + 1}` });
      state.recipes.push(r);
      save();
      ui.recipeId = r.id;
      go('recipe');
      const nameInput = document.getElementById('recipe-name');
      if (nameInput) { nameInput.focus(); nameInput.select(); }
      break;
    }

    case 'open-recipe':
      ui.recipeId = el.dataset.id;
      go('recipe');
      if (el.dataset.then === 'photo') {
        const zone = app.querySelector('.dropzone');
        if (zone) { zone.scrollIntoView({ block: 'center' }); zone.classList.add('pulse'); }
      }
      break;

    case 'caption-to-text':
      ui.importText = ui.link.caption || '';
      ui.link = { status: 'idle' };
      ui.focusKey = 'import-text';
      render();
      break;

    case 'bookmarklet-hint':
      e.preventDefault();
      toast('Drag this button to your bookmarks bar instead of clicking it');
      break;

    case 'image-remove':
      if (recipe && confirm('Remove this photo?')) setRecipeImage(recipe, '', 'Photo removed');
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
      if (recipe && confirm(`Delete “${recipe.name || 'this recipe'}”?`)) {
        state.recipes = state.recipes.filter((r) => r.id !== recipe.id);
        save();
        go('library');
        toast('Recipe deleted');
      }
      break;

    case 'remove-ingredient': {
      const i = recipe.ingredients.findIndex((n) => norm(n) === norm(el.dataset.name));
      if (i > -1) recipe.ingredients.splice(i, 1);
      delete recipe.amounts[norm(el.dataset.name)];
      save();
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
      addToList(ui.targetListId, [el.dataset.name], recipe);
      render();
      break;

    case 'add-missing-all':
      addToList(ui.targetListId, missingFor(recipe), recipe);
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

    case 'reset-demo':
      if (confirm('Reset all demo data? Your recipes, fridge and lists will be replaced with the sample data.')) {
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

  if (action === 'toggle-fridge' && recipe) {
    recipe.useFridge = el.checked;
    save();
    render();
  } else if (action === 'image-file') {
    addPhotoFile(el.files && el.files[0]);
  } else if (action === 'target-list') {
    ui.targetListId = el.value;
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
  const { bind } = el.dataset;
  if (!bind) return;
  const recipe = findRecipe(ui.recipeId);
  if (el.matches('textarea[data-autosize]')) autosize(el);

  if (bind === 'recipe-name' && recipe) recipe.name = el.value;
  else if (bind === 'recipe-desc' && recipe) recipe.description = el.value;
  else if (bind === 'recipe-directions' && recipe) recipe.directions = el.value;
  else if (bind === 'import-text') { ui.importText = el.value; return; }
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
      const recipe = findRecipe(ui.recipeId);
      splitItems(value).forEach((n) => {
        if (!recipe.ingredients.some((x) => norm(x) === norm(n))) recipe.ingredients.push(n);
      });
      ui.focusKey = 'add-ingredient';
      break;
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
      const recipe = findRecipe(ui.recipeId);
      if (!/^https?:\/\/\S+$/i.test(url)) { toast('Paste a full image link starting with https://'); return; }
      setRecipeImage(recipe, url, 'Photo added');
      return;
    }

    case 'import-text': {
      const recipe = importRecipeText(value);
      if (!recipe) { toast('Paste some recipe text first'); return; }
      state.recipes.push(recipe);
      save();
      ui.importText = '';
      ui.recipeId = recipe.id;
      go('recipe');
      const steps = recipe.directions.split('\n').filter((l) => /^\d+\. /.test(l)).length;
      toast(`Imported “${recipe.name}” · ${plural(recipe.ingredients.length, 'ingredient')} · ${plural(steps, 'step')}`);
      return;
    }

    default:
      return;
  }

  save();
  render();
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
  addPhotoFile(e.dataTransfer.files[0]);
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
