# Cookbook-App
CS3560 Project 2

## Demo (browser)

A plain HTML/CSS/JavaScript demo of the app's core ideas. No build step, no server, no dependencies.

**Run it:** download or clone this branch and open `index.html` in any browser.

### What works
- **Library** — create as many recipes as you want, rename them, write a description, and add ingredients.
  Each card has a collapsible description, collapsible directions, and its ingredient list.
- **Favorites** — tap the star on any recipe (on its library thumbnail or inside the recipe). Favorited recipes get a
  filled gold star and are pinned to the top of the library; unfavorited ones show an outline star.
- **Directions** — every recipe has its own Directions text field for the step-by-step method.
- **Photos** — add a picture of the finished dish to any recipe: choose a file, drag an image onto the photo
  area, or paste an image link. Uploaded photos are shrunk to 1000px JPEGs (~50–150 KB) so they fit in browser
  storage. In the library each card shows the photo as a thumbnail under the title, with the favorite star
  sitting on its corner. Recipes without a photo show an empty frame — click it to add one.
- **Fridge** — keep track of what you have at home. Shows which recipes you can make right now.
- **Lists** — create multiple named shopping lists, check items off, and move bought items into the fridge.
- **Fridge check** — in each recipe, ingredients you don't have are highlighted red and moved to the top.
  This can be turned off per recipe.
- **Quick add** — send one or all missing ingredients to any shopping list (or a new one).
- **Import → Text** — copy an entire recipe web page and paste it in. The scanner (`parser.js`) skips the
  blog story, ads, ratings, buttons and comments, then pulls out:
  - the recipe **name**
  - every **ingredient** (saved to the ingredient list, with its amount shown beside it, e.g. *All-purpose flour — 2 1/4 cups (281g)*)
  - the numbered **directions**, including sub-headings like "For the sauce:"
  - a short **description** with prep/cook times, servings and any recipe notes

  It's rule-based (no AI), so always glance over the result — everything stays editable.

### Tests
The text scanner is tested against sample pasted articles in `tests/articles/` (food blog, Allrecipes-style
"Step 1" pages, grouped ingredients, no headings, and a hand-typed recipe). Requires Node 18+.

```
node --test tests/parser.test.js   # run the checks
node tests/run.js                  # print what the scanner pulls out of each sample
```

### Planned (shown as placeholders)
- Import from a photo of a cookbook page
- Import from a social media link
- Scan a photo of your fridge to update ingredients

Data is saved in your browser's localStorage (about 5 MB — roughly 30–60 recipe photos). If it fills up,
the app tells you instead of silently dropping the photo. Use **Reset demo data** in the footer to restore the sample recipes.
