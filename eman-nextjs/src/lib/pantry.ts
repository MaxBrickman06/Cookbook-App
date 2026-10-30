const PANTRY_KEY = "cookbook-pantry";

const DEFAULT_PANTRY = [
  "Chicken Breast",
  "Eggs",
  "Rice",
  "Garlic",
  "Olive Oil",
  "Parmesan",
  "Spinach",
  "Pasta",
];

export function getPantryItems(): string[] {
  if (typeof window === "undefined") {
    return DEFAULT_PANTRY;
  }

  const storedPantry = localStorage.getItem(PANTRY_KEY);

  if (!storedPantry) {
    return DEFAULT_PANTRY;
  }

  try {
    return JSON.parse(storedPantry);
  } catch {
    return DEFAULT_PANTRY;
  }
}

export function hasIngredient(
  ingredientName: string
): boolean {
  const pantryItems = getPantryItems();

  return pantryItems.some(
    (item) =>
      item.toLowerCase() === ingredientName.toLowerCase()
  );
}

export function getMissingIngredients(
  ingredientNames: string[]
): string[] {
  return ingredientNames.filter(
    (ingredient) => !hasIngredient(ingredient)
  );
}