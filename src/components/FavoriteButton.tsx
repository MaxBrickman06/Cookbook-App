"use client";

import { useEffect, useState } from "react";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import styles from "./RecipeCard.module.css";

type FavoriteButtonProps = {
  recipeId: number;
};

export default function FavoriteButton({
  recipeId,
}: FavoriteButtonProps) {
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    const updateFavorite = () => {
      setFavorite(isFavorite(recipeId));
    };

    updateFavorite();

    window.addEventListener(
      "favoritesChanged",
      updateFavorite
    );

    return () => {
      window.removeEventListener(
        "favoritesChanged",
        updateFavorite
      );
    };
  }, [recipeId]);

  function handleFavorite() {
    setFavorite(toggleFavorite(recipeId));
  }

  return (
    <button
      type="button"
      className={`${styles.favoriteButton} ${
        favorite ? styles.favoriteActive : ""
      }`}
      aria-label={
        favorite
          ? "Remove from favorites"
          : "Add to favorites"
      }
      aria-pressed={favorite}
      onClick={handleFavorite}
    >
      {favorite ? "♥" : "♡"}
    </button>
  );
}