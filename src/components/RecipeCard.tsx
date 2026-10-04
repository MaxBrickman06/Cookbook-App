
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Recipe } from "@/data/recipes";
import {
  isFavorite,
  toggleFavorite,
} from "@/lib/favorites";

type RecipeCardProps = {
  recipe: Recipe;
};

export default function RecipeCard({
  recipe,
}: RecipeCardProps) {
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    setFavorite(isFavorite(recipe.id));

    const handleFavoritesChanged = () => {
      setFavorite(isFavorite(recipe.id));
    };

    window.addEventListener(
      "favoritesChanged",
      handleFavoritesChanged
    );

    return () => {
      window.removeEventListener(
        "favoritesChanged",
        handleFavoritesChanged
      );
    };
  }, [recipe.id]);

  function handleFavorite() {
    const newFavoriteState = toggleFavorite(recipe.id);

    setFavorite(newFavoriteState);
  }

  return (
    <article className="recipe-card">
      <div className="recipe-image-container">
        <img
          src={recipe.image}
          alt={recipe.title}
          className="recipe-image"
        />

        <button
          className={
            favorite
              ? "favorite-button favorite-active"
              : "favorite-button"
          }
          aria-label={
            favorite
              ? "Remove from favorites"
              : "Add to favorites"
          }
          onClick={handleFavorite}
        >
          {favorite ? "♥" : "♡"}
        </button>
      </div>

      <div className="recipe-content">
        <div className="recipe-meta">
          <span>{recipe.category}</span>
          <span>{recipe.cookTime}</span>
        </div>

        <h3>{recipe.title}</h3>

        <p>{recipe.description}</p>

        <Link
          href={`/recipes/${recipe.id}`}
          className="view-recipe-button"
        >
          View Recipe →
        </Link>
      </div>
    </article>
  );
}
