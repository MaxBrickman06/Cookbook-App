import { recipes } from "@/data/recipes";

export const favoriteRecipes = recipes.filter(
  (recipe) => recipe.id === 1 || recipe.id === 3
);