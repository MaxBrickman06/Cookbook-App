/* Cookbook App — browser demo
 * Plain JavaScript, no frameworks, no AI. All data lives in localStorage.
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
        description: 'Mash the potatoes, mix in the cheese and garlic, roll into bites and fry until golden and crispy.',
        ingredients: ['Potatoes', 'Parmesan cheese', 'Mozzarella', 'Garlic powder', 'Eggs', 'Cornstarch'],
        useFridge: true,
      },
      {
        id: uid(),
        name: 'Pancakes',
        description: 'Whisk the dry ingredients, then the wet ones, combine and cook on a hot buttered pan.',
        ingredients: ['Flour', 'Sugar', 'Eggs', 'Milk', 'Butter', 'Baking powder'],
        useFridge: true,
      },
      {
        id: uid(),
        name: 'Cajun Roasted Potatoes',
        description: 'Toss halved potatoes in oil and Cajun seasoning. Roast at 425°F for about 35 minutes.',
        ingredients: ['Potatoes', 'Olive oil', 'Cajun seasoning'],
        useFridge: true,
      },
    ],
    fridge: ['Eggs', 'Milk', 'Potatoes', 'Garlic powder', 'Olive oil', 'Cajun seasoning'],
    lists: [
      { id: uid(), name: 'Weekly groceries', items: [{ name: 'Bread', done: false }] },
    ],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* storage unavailable — fall back to seed */ }
  return seedData();
}

let state = loadState();

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

/* UI-only state (not saved) */
const ui = {
  view: 'library',
  recipeId: null,
  targetListId: null,
  focusKey: null,
};

/* ---------------- domain logic ---------------- */

const findRecipe = (id) => state.recipes.find((r) => r.id === id);
const findList = (id) => state.lists.find((l) => l.id === id);
const inFridge = (name) => state.fridge.some((f) => norm(f) === norm(name));

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

  if (ui.focusKey) {
    const el = app.querySelector(`[data-focus="${ui.focusKey}"]`);
    if (el) el.focus();
    ui.focusKey = null;
  }
}

function renderLibrary() {
  const cards = state.recipes.map((r) => {
    const ings = orderedIngredients(r);
    const missing = ings.filter((i) => i.missing).length;
    let status = '';
    if (!r.useFridge) status = '<span class="tag">fridge check off</span>';
    else if (!r.ingredients.length) status = '<span class="tag">no ingredients</span>';
    else if (missing) status = `<span class="tag need">${missing} missing</span>`;
    else status = '<span class="tag have">ready to cook</span>';

    return `
      <article class="recipe-card">
        <div class="card-top">
          <h3>${esc(r.name || 'Untitled recipe')}</h3>
          <button class="btn ghost small" data-action="open-recipe" data-id="${r.id}">Open</button>
        </div>
        <div class="card-meta">${status}<span class="tag">${plural(r.ingredients.length, 'ingredient')}</span></div>
        <details class="desc">
          <summary>Description</summary>
          ${r.description.trim()
            ? `<p>${esc(r.description)}</p>`
            : '<p class="none">No description yet.</p>'}
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
        <p class="sub">${plural(state.recipes.length, 'recipe')} · red ingredients aren't in your fridge</p>
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
        <span class="ing-name">${esc(i.name)}</span>
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
      <button class="btn ghost danger" data-action="delete-recipe">Delete recipe</button>
    </div>

    <section class="panel">
      <label class="field-label" for="recipe-name">Recipe name</label>
      <input type="text" id="recipe-name" class="title-input" data-bind="recipe-name"
             value="${esc(r.name)}" placeholder="Name this dish">
      <label class="field-label" for="recipe-desc">Description</label>
      <textarea id="recipe-desc" data-bind="recipe-desc"
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
    </section>`;
}

function renderFridge() {
  const items = [...state.fridge].sort((a, b) => a.localeCompare(b));
  const ready = state.recipes.filter((r) => r.useFridge && r.ingredients.length && !missingFor(r).length);

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
            `<li><button data-action="open-recipe" data-id="${r.id}">${esc(r.name || 'Untitled recipe')}</button></li>`).join('')}</ul>`
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

function renderImport() {
  return `
    <div class="view-head">
      <div>
        <h2>Import</h2>
        <p class="sub">Bring recipes in from elsewhere</p>
      </div>
    </div>

    <div class="import-grid">
      <section class="panel soon">
        <h3>Photo <span class="tag">planned</span></h3>
        <p class="sub">Scan a cookbook page and pull out the recipe text.</p>
      </section>
      <section class="panel soon">
        <h3>Link <span class="tag">planned</span></h3>
        <p class="sub">Paste a social media post or video link and find the recipe in it.</p>
      </section>
    </div>

    <section class="panel">
      <div class="panel-head"><h3>Text</h3><span class="tag have">works in demo</span></div>
      <p class="sub" style="margin:0 0 12px">
        Paste a recipe. The first line becomes the name; lines under an “Ingredients” heading become
        ingredients; everything else goes into the description. Simple rule-based parsing — no AI.
      </p>
      <form data-form="import-text">
        <textarea name="text" rows="9" placeholder="Garlic Butter Noodles
Quick weeknight dinner.

Ingredients:
- 8 oz spaghetti
- 3 tbsp butter
- 4 cloves garlic, minced
- Parmesan cheese

Directions:
Boil the pasta. Melt butter with garlic, toss together, top with parmesan."></textarea>
        <div style="margin-top:10px"><button class="btn">Scan text</button></div>
      </form>
    </section>`;
}

/* ---------------- text import (rule-based) ---------------- */

const UNIT_RE = /^(cups?|c\.|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|l|liters?|cloves?|pinch(es)?|dash(es)?|cans?|slices?|sticks?|packages?|pkgs?|bunch(es)?|heads?|large|medium|small)\b\.?\s*(of\s+)?/i;

function cleanIngredient(line) {
  let s = line.replace(/^[-*•·]\s*/, '').replace(/^\d+[.)]\s+/, '');
  const qty = s.match(/^[\d\s/.½¼¾⅓⅔⅛-]+/);
  if (qty && /\d|[½¼¾⅓⅔⅛]/.test(qty[0])) {
    s = s.slice(qty[0].length);
    s = s.replace(UNIT_RE, '');
  }
  s = s.replace(/\(.*?\)/g, '').split(',')[0].trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function parseRecipeText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const firstIdx = lines.findIndex(Boolean);
  if (firstIdx === -1) return null;

  const name = lines[firstIdx].replace(/^#+\s*/, '');
  const ingredients = [];
  const desc = [];
  let section = 'desc';

  lines.slice(firstIdx + 1).forEach((line) => {
    const heading = line.toLowerCase().replace(/[:#*]/g, '').trim();
    if (/^ingredients?$/.test(heading)) { section = 'ing'; return; }
    if (/^(directions|instructions|method|steps|preparation|description|notes)$/.test(heading)) {
      section = 'desc';
      if (desc.length) desc.push('');
      return;
    }
    if (section === 'ing') {
      if (!line) return;
      const ing = cleanIngredient(line);
      if (ing && !ingredients.some((x) => norm(x) === norm(ing))) ingredients.push(ing);
    } else {
      desc.push(line);
    }
  });

  return {
    id: uid(),
    name,
    description: desc.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    ingredients,
    useFridge: true,
  };
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
      const r = { id: uid(), name: `Recipe ${state.recipes.length + 1}`, description: '', ingredients: [], useFridge: true };
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
      break;

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

  if (bind === 'recipe-name' && recipe) recipe.name = el.value;
  else if (bind === 'recipe-desc' && recipe) recipe.description = el.value;
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

    case 'import-text': {
      const recipe = parseRecipeText(value);
      if (!recipe) { toast('Paste some recipe text first'); return; }
      state.recipes.push(recipe);
      save();
      ui.recipeId = recipe.id;
      go('recipe');
      toast(`Imported “${recipe.name}” with ${plural(recipe.ingredients.length, 'ingredient')}`);
      return;
    }

    default:
      return;
  }

  save();
  render();
});

render();
