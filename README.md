# Cookbook-App
CS3560 Project 2

## Demo (browser)

A plain HTML/CSS/JavaScript demo of the app's core ideas. No build step, no server, no dependencies.

**Run it:** download or clone this branch and open `index.html` in any browser.

### What works
- **Library** — create as many recipes as you want, rename them, write a description, and add ingredients.
  Each card has a collapsible description and its ingredient list.
- **Fridge** — keep track of what you have at home. Shows which recipes you can make right now.
- **Lists** — create multiple named shopping lists, check items off, and move bought items into the fridge.
- **Fridge check** — in each recipe, ingredients you don't have are highlighted red and moved to the top.
  This can be turned off per recipe.
- **Quick add** — send one or all missing ingredients to any shopping list (or a new one).
- **Import → Text** — paste a recipe; simple rule-based parsing pulls out the name, ingredients and description.

### Planned (shown as placeholders)
- Import from a photo of a cookbook page
- Import from a social media link
- Scan a photo of your fridge to update ingredients

Data is saved in your browser's localStorage. Use **Reset demo data** in the footer to restore the sample recipes.
