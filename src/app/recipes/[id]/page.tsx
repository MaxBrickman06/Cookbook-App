
"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { recipes } from "@/data/recipes";
import {
  getMissingIngredients,
  hasIngredient,
} from "@/lib/pantry";
import {
  isFavorite,
  toggleFavorite,
} from "@/lib/favorites";

type RecipePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default function RecipePage({
  params,
}: RecipePageProps) {
  const [recipeId, setRecipeId] = useState<number | null>(
    null
  );

  const [favorite, setFavorite] = useState(false);
  const [pantryReady, setPantryReady] = useState(false);

  useEffect(() => {
    params.then(({ id }) => {
      const numericId = Number(id);

      setRecipeId(numericId);
      setFavorite(isFavorite(numericId));
      setPantryReady(true);
    });
  }, [params]);

  if (recipeId === null) {
    return null;
  }

  const recipe = recipes.find(
    (recipe) => recipe.id === recipeId
  );

  if (!recipe) {
    notFound();
  }

  const ingredientNames = recipe.ingredients.map(
    (ingredient) => ingredient.name
  );

  const missingIngredients = pantryReady
    ? getMissingIngredients(ingredientNames)
    : [];

  function handleFavorite() {
    const newFavoriteState = toggleFavorite(recipe.id);

    setFavorite(newFavoriteState);
  }

  return (
    <main className="recipe-detail-page">
      <Link href="/recipes" className="back-link">
        ← Back to recipes
      </Link>

      <section className="recipe-detail-hero">
        <div className="recipe-detail-image-container">
          <img
            src={recipe.image}
            alt={recipe.title}
            className="recipe-detail-image"
          />
        </div>

        <div className="recipe-detail-info">
          <div className="recipe-meta">
            <span>{recipe.category}</span>
            <span>{recipe.cookTime}</span>
          </div>

          <h1>{recipe.title}</h1>

          <p className="recipe-detail-description">
            {recipe.description}
          </p>

          <div className="recipe-stats">
            <div>
              <strong>{recipe.cookTime}</strong>
              <span>Cook time</span>
            </div>

            <div>
              <strong>{recipe.servings}</strong>
              <span>Servings</span>
            </div>
          </div>

          <button
            className="favorite-recipe-button"
            onClick={handleFavorite}
          >
            {favorite
              ? "♥ Remove from Favorites"
              : "♡ Add to Favorites"}
          </button>
        </div>
      </section>

      <section className="recipe-detail-content">
        <div className="ingredients-section">
          <div className="ingredients-header">
            <div>
              <h2>Ingredients</h2>

              <p>
                {recipe.ingredients.length -
                  missingIngredients.length}{" "}
                of {recipe.ingredients.length} ingredients
                available
              </p>
            </div>
          </div>

          <div className="ingredients-list">
            {recipe.ingredients.map((ingredient) => {
              const available = pantryReady
                ? hasIngredient(ingredient.name)
                : false;

              return (
                <div
                  key={ingredient.name}
                  className={
                    available
                      ? "ingredient-row available"
                      : "ingredient-row missing"
                  }
                >
                  <span>{ingredient.amount}</span>

                  <p>{ingredient.name}</p>

                  <strong>
                    {available ? "✓ Have" : "Need"}
                  </strong>
                </div>
              );
            })}
          </div>

          {missingIngredients.length > 0 && (
            <button className="shopping-list-button">
              + Add Missing Ingredients to Shopping List
            </button>
          )}

          {missingIngredients.length === 0 && (
            <div className="all-ingredients-message">
              ✓ You have everything needed for this recipe.
            </div>
          )}
        </div>

        <div className="directions-section">
          <h2>Directions</h2>

          <div className="directions-list">
            {recipe.directions.map((direction, index) => (
              <div
                key={index}
                className="direction-step"
              >
                <span>{index + 1}</span>

                <p>{direction}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
