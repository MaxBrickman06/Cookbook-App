# Cookbook-App
CS3560 Project 2

## Demo (browser)

A plain HTML/CSS/JavaScript app with a tiny Node.js server. No frameworks, no build step, no dependencies to install.

**Windows — one click:** double-click **`Install Cookbook.cmd`** once. It puts a **Cookbook** icon on your desktop
(and in the Start menu) and opens the app. From then on, just double-click the icon:
- the server starts in the background (no console window) and Cookbook opens in its own app window;
- if Node.js isn't installed, the first launch downloads the official portable Node.js from nodejs.org
  (~30 MB, one time), checks its SHA-256 fingerprint, and keeps it in `%LOCALAPPDATA%\Cookbook` — nothing is
  installed system-wide;
- closing the window stops the server a few minutes later; clicking the icon while it's running opens another window.

If you move the project folder, run `Install Cookbook.cmd` again. To remove the icons: run
`"Install Cookbook.cmd" /uninstall` from a terminal in the folder. Server logs are in `%LOCALAPPDATA%\Cookbook`.

**Any computer with Node.js 18+:** in this folder run

```
npm run app      # starts the server and opens the app window
npm start        # just the server — then open http://localhost:3560
```

**Quick look without Node:** open `index.html` directly in a browser. Everything works except importing from a link
(browsers don't let a page read other websites, so that part goes through the server).

### What works
- **Library** — every recipe as a card with its photo, estimated time, description and ingredients.
  Recipes short of something in your fridge get a red **!** next to their name.
  - **Search** by recipe name, by an ingredient, or by several ingredients at once (`eggs, milk, butter` finds
    recipes that use all three). Choose *Name & ingredients*, *Name* or *Ingredients* to narrow what's searched.
    Matching ingredients are outlined on each card. Press Esc to clear.
  - While searching, recipes you can make right now are listed first, then the ones missing something.
  - **Filters:** *★ Favorites only*, *Can make now* (every ingredient is in your fridge), *! Missing ingredients*,
    and a time filter (≤ 15 min, ≤ 30 min, ≤ 1 hr, ≤ 2 hr — recipes without a time are hidden while it's on).
- **Recipe page** — opens **read-only**: photo, name, description, ingredients (what you have / need) and numbered
  directions. Anything left empty simply doesn't show. You can still add missing ingredients to a shopping list or
  mark them "Got it" without editing.
- **Edit** — the ✎ Edit button opens the recipe as a form (photo, name, estimated time, description, ingredients, directions).
  Names are 1–100 characters. Saving with an empty name fills it from the first line of the description and asks you
  to check it and press Save again; with no description either, the recipe can't be saved until it has a name.
  Changes stay in the form until you press **Save changes** (or Ctrl+S); **Cancel** throws them away. Leaving the
  page with unsaved changes asks first. Ingredients can be typed with amounts, e.g. `2 cups flour`.
  New recipes open straight into the form and aren't added to the library until saved.
- **Favorites** — tap the star on any recipe (on its library thumbnail or inside the recipe). Favorited recipes get a
  filled gold star and are pinned to the top of the library; unfavorited ones show an outline star.
- **Photos** — add a picture of the finished dish in Edit: choose a file, drag an image onto the photo
  area, or paste an image link. Uploaded photos are shrunk to 1000px JPEGs (~50–150 KB) so they fit in browser
  storage. In the library each card shows the photo as a thumbnail under the title, with the favorite star
  sitting on its corner. Recipes without a photo show an empty frame — click it to add one.
- **Fridge** — keep track of what you have at home. Shows which recipes you can make right now.
- **Lists** — create multiple named shopping lists, check items off, and move bought items into the fridge.
- **Fridge check** — each recipe's ingredients are sorted and coloured: **red** = not in your fridge or on any list
  (shown first), **yellow** = not in your fridge but already on a shopping list, **blue** = in your fridge.
  This can be turned off per recipe.
- **Add to List** — appears when anything is red or yellow. It opens a window with all your shopping lists (plus
  *New list*); tick one or several and every needed ingredient is added to each list that doesn't already have it.
  *+ List* on a single row does the same for one ingredient.
- **Import** — the *⤓ Import* button on the library opens a window: *Import by URL*, *Paste text* or *Text file* (.txt).
  PDF and Photo are shown as planned. The Import tab has the same link and text importers.
  Every import opens the recipe **pre-filled in the edit form** — nothing is added to the library until you press
  **Save changes**; **Cancel** leaves the library as it was.
- **Import → Text** — copy an entire recipe web page and paste it in. The scanner (`parser.js`) skips the
  blog story, ads, ratings, buttons and comments, then pulls out:
  - the recipe **name**
  - every **ingredient** (saved to the ingredient list, with its amount shown beside it, e.g. *All-purpose flour — 2 1/4 cups (281g)*)
  - the numbered **directions**, including sub-headings like "For the sauce:"
  - the **estimated time** (the recipe's total time, or prep + cook added up)
  - a short **description** with prep/cook times, servings and any recipe notes

  It's rule-based (no AI), so always glance over the result — everything stays editable.

- **Import → Link** — paste (or drag in) a link and press **Scan**; the recipe is read automatically, photo included:
  - **Recipe websites:** most recipe sites include hidden, structured recipe data for Google; the app reads that
    first (exact ingredients, steps, times, servings, photo). Otherwise it reads the page text with the scanner.
  - **TikTok:** the video caption, read through TikTok's public embed service (oEmbed). Short `vm.tiktok.com` links work.
  - **Instagram posts & Reels:** the caption, read from Instagram's public embed page.
  - **YouTube videos & Shorts:** the video description. If the description only links to the full recipe on a
    website ("Full recipe: https://…"), the app follows that link and imports the recipe from the site.
  - What can go wrong, and what you see (spec use case, section 8):
    - not a full `http(s)://` link → *"Enter a full link starting with http"* (nothing is sent)
    - page unreachable or slower than 10 s → *"Couldn't reach that page"* (nothing saved)
    - no ingredient list on the page → *"No recipe found on that page"* (nothing saved). For a video caption the app
      offers to move the caption into Text import to edit.
    - ingredients found but no directions → the form opens with directions empty and a yellow warning
- **Share to the app:**
  - **Android:** open the app in Chrome → menu → *Add to Home screen / Install app*. "Cookbook" then appears in the
    Share menu of TikTok, Instagram, YouTube and Chrome — sharing a video imports its recipe.
  - **iPhone:** iOS doesn't let web apps appear in the Share menu, so use *Share → Copy link* and paste it.
  - **Computer:** drag the **+ Cookbook** button (Import → Link → "Share straight from…") to the bookmarks bar and
    click it on any recipe or video page.

  Installing / sharing from a phone needs the app at an `https://` address (or `localhost` on the same device).
  To try it on your phone, host it somewhere free that runs Node (e.g. Render, Railway, Fly.io — start command
  `npm start`; the server listens on `$PORT`), or tunnel your laptop with `npx localtunnel --port 3560` or
  `cloudflared tunnel --url http://localhost:3560`.

#### Link import limits (worth knowing for the demo)
- TikTok and Instagram don't offer an official "give me the caption" API for apps like this, so the app reads the
  same public data their embeds and link previews use (YouTube too, unless you add an API key — see below). If a
  platform changes its pages, that platform can stop working until the code is updated.
- **Instagram is the least reliable:** it often hides captions from apps, and private accounts can't be read.
  When that happens the app tells you to copy the caption and use Text import.
- Private, age-restricted or deleted videos can't be read. Some recipe sites block automated requests.
- **YouTube (optional, more reliable):** create a free YouTube Data API key in Google Cloud Console and start the
  server with `YOUTUBE_API_KEY=your_key npm start` — the app then uses YouTube's official API for descriptions.
- Recipes found in a caption are only as good as the caption: if the creator lists ingredients without amounts,
  the app can't invent them. Everything stays editable after import.
- The server only fetches public `http(s)` addresses (no `localhost` / private network addresses), follows at most
  5 redirects, gives up after 10 seconds per page (redirects included) and refuses pages over 4 MB.

### Tests
No internet needed — websites, TikTok, Instagram and YouTube responses are faked from files in `tests/pages/`.

```
npm test             # scanner, link import and server safety checks
node tests/run.js    # print what the scanner pulls out of each sample article
```

- `tests/parser.test.js` — pasted articles in `tests/articles/` (food blog, "Step 1" pages, grouped ingredients, no headings)
- `tests/importer.test.js` — recipe-site data, YouTube descriptions, TikTok/Instagram captions, links to full recipes
- `tests/server.test.js` — refuses private network addresses; only serves the app's own files
- `tests/cookbook.test.js` — the checks named in the requirements spec: `recipe_requires_name` (FR-1),
  `search_matches_all_terms` (FR-2), `add_missing_no_duplicates` (FR-4), `parser_50kb_under_10s` (NFR-1),
  plus the red/yellow/blue order (FR-3) and complete-first search results (US-1)

### Files
| File | What it does |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | The app (library, recipe page, fridge, lists, import) |
| `cookbook.js` | The spec's recipe rules shared by the app and tests: names, search, have/on a list/need, adding to lists |
| `parser.js` | Rule-based recipe scanner for pasted text and captions (runs in the browser and on the server) |
| `importer.js` | Reads a recipe from a link: recipe sites, TikTok, Instagram, YouTube |
| `server.js` | Serves the app and the `/api/import` route; fetches links safely |
| `manifest.webmanifest`, `sw.js`, `icons/` | Make the app installable and able to receive shared links |
| `Install Cookbook.cmd`, `launcher/` | Windows desktop icon: one-time setup and the launcher it runs |

### Planned (shown as placeholders)
- Import from a PDF
- Import from a photo of a cookbook page
- Scan a photo of your fridge to update ingredients

Data is saved in your browser's localStorage (about 5 MB — roughly 30–60 recipe photos). If it fills up,
the app tells you instead of silently dropping the photo. Use **Reset demo data** in the footer to restore the sample recipes.
