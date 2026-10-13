
"use client";

import { useEffect, useState } from "react";
import type { Recipe } from "@/data/recipes";
import {
  getMissingIngredients,
  hasIngredient,
} from "@/lib/pantry";
import styles from "./page.module.css";

type IngredientAvailabilityProps = {
  ingredients: Recipe["ingredients"];
};

export default function IngredientAvailability({
  ingredients,
}: IngredientAvailabilityProps) {
  const [pantryReady, setPantryReady] = useState(false);

  useEffect(() => {
    setPantryReady(true);
  }, []);

  const ingredientNames = ingredients.map(
    (ingredient) => ingredient.name
  );

  const missingIngredients = pantryReady
    ? getMissingIngredients(ingredientNames)
    : [];

  const availableCount = pantryReady
    ? ingredients.length - missingIngredients.length
    : 0;

  return (
    <div className={styles.ingredientsSection}>
      <div className={styles.ingredientsHeader}>
        <div>
          <h2>Ingredients</h2>

          <p>
            {pantryReady
              ? `${availableCount} of ${ingredients.length} ingredients available`
              : "Checking pantry..."}
          </p>
        </div>
      </div>

      <div className={styles.ingredientsList}>
        {ingredients.map((ingredient) => {
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
                {!pantryReady
                  ? "..."
                  : available
                    ? "✓ Have"
                    : "Need"}
              </strong>
            </div>
          );
        })}
      </div>

      {pantryReady && missingIngredients.length > 0 && (
        <button
          type="button"
          className={styles.shoppingListButton}
        >
          + Add Missing Ingredients to Shopping List
        </button>
      )}

      {pantryReady && missingIngredients.length === 0 && (
        <div className={styles.allIngredientsMessage}>
          ✓ You have everything needed for this recipe.
        </div>
      )}
    </div>
  );
}
