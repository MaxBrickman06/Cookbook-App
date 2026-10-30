const FAVORITES_KEY = "cookbook-favorites";

const DEFAULT_FAVORITES = [1, 3];

export function getFavoriteIds(): number[] {
  if (typeof window === "undefined") {
    return DEFAULT_FAVORITES;
  }

  const storedFavorites = localStorage.getItem(FAVORITES_KEY);

  if (!storedFavorites) {
    return DEFAULT_FAVORITES;
  }

  try {
    return JSON.parse(storedFavorites);
  } catch {
    return DEFAULT_FAVORITES;
  }
}

export function isFavorite(recipeId: number): boolean {
  return getFavoriteIds().includes(recipeId);
}

export function toggleFavorite(recipeId: number): boolean {
  const favoriteIds = getFavoriteIds();

  const alreadyFavorite = favoriteIds.includes(recipeId);

  const updatedFavorites = alreadyFavorite
    ? favoriteIds.filter((id) => id !== recipeId)
    : [...favoriteIds, recipeId];

  localStorage.setItem(
    FAVORITES_KEY,
    JSON.stringify(updatedFavorites)
  );

  window.dispatchEvent(new Event("favoritesChanged"));

  return !alreadyFavorite;
}   