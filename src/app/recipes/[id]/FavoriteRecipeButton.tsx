
"use client";

import { useEffect, useState } from "react";
import {
  isFavorite,
  toggleFavorite,
} from "@/lib/favorites";
import styles from "./page.module.css";

type FavoriteRecipeButtonProps = {
  recipeId: number;
};

export default function FavoriteRecipeButton({
  recipeId,
}: FavoriteRecipeButtonProps) {
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
    const newFavoriteState = toggleFavorite(recipeId);
    setFavorite(newFavoriteState);
  }

  return (
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
  );
}
