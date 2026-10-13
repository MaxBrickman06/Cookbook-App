
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
import styles from "./page.module.css";

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
    <main className={styles.recipeDetailPage}>
      <Link href="/recipes" className={styles.backLink}>
        ← Back to recipes
      </Link>

      <section className={styles.recipeDetailHero}>
        <div className={styles.recipeDetailImageContainer}>
          <img
            src={recipe.image}
            alt={recipe.title}
            className={styles.recipeDetailImage}
          />
        </div>

        <div className={styles.recipeDetailInfo}>
          <div className={styles.recipeMeta}>
            <span>{recipe.category}</span>
            <span>{recipe.cookTime}</span>
          </div>

          <h1>{recipe.title}</h1>

          <p className={styles.recipeDetailDescription}>
            {recipe.description}
          </p>

          <div className={styles.recipeStats}>
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
            type="button"
            className={styles.favoriteRecipeButton}
            onClick={handleFavorite}
            aria-pressed={favorite}
          >
            {favorite
              ? "♥ Remove from Favorites"
              : "♡ Add to Favorites"}
          </button>
        </div>
      </section>

      <section className={styles.recipeDetailContent}>
        <div className={styles.ingredientsSection}>
          <div className={styles.ingredientsHeader}>
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

          <div className={styles.ingredientsList}>
            {recipe.ingredients.map((ingredient) => {
              const available = pantryReady
                ? hasIngredient(ingredient.name)
                : false;

              return (
                <div
                  key={ingredient.name}
                  className={`${styles.ingredientRow} ${
                    available
                      ? styles.available
                      : styles.missing
                  }`}
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
            <button
              type="button"
              className={styles.shoppingListButton}
            >
              + Add Missing Ingredients to Shopping List
            </button>
          )}

          {missingIngredients.length === 0 && (
            <div className={styles.allIngredientsMessage}>
              ✓ You have everything needed for this recipe.
            </div>
          )}
        </div>

        <div className={styles.directionsSection}>
          <h2>Directions</h2>

          <div className={styles.directionsList}>
            {recipe.directions.map((direction, index) => (
              <div
                key={index}
                className={styles.directionStep}
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
