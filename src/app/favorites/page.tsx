
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import RecipeCard from "@/components/RecipeCard";
import { recipes } from "@/data/recipes";
import { getFavoriteIds } from "@/lib/favorites";
import styles from "./page.module.css";

export default function FavoritesPage() {
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  useEffect(() => {
    const loadFavorites = () => {
      setFavoriteIds(getFavoriteIds());
    };

    loadFavorites();

    window.addEventListener(
      "favoritesChanged",
      loadFavorites
    );

    return () => {
      window.removeEventListener(
        "favoritesChanged",
        loadFavorites
      );
    };
  }, []);

  const favoriteRecipes = recipes.filter((recipe) =>
    favoriteIds.includes(recipe.id)
  );

  return (
    <>
      <Navbar />

      <main className={styles.favoritesPage}>
        <section className={styles.favoritesHeader}>
          <div>
            <p className={styles.sectionLabel}>
              YOUR COLLECTION
            </p>

            <h1>Favorites</h1>

            <p className={styles.favoritesIntro}>
              Keep the recipes you love most in one place.
            </p>
          </div>
        </section>

        {favoriteRecipes.length > 0 ? (
          <section className={styles.favoritesSection}>
            <div className={styles.favoritesSectionHeader}>
              <div>
                <h2>Your Favorites</h2>

                <span>
                  {favoriteRecipes.length}{" "}
                  {favoriteRecipes.length === 1
                    ? "saved recipe"
                    : "saved recipes"}
                </span>
              </div>
            </div>

            <div className={styles.recipeGrid}>
              {favoriteRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className={styles.emptyFavorites}>
            <div className={styles.emptyFavoritesIcon}>
              ♡
            </div>

            <h2>No favorites yet</h2>

            <p>
              Recipes you save as favorites will appear
              here.
            </p>

            <Link
              href="/recipes"
              className={styles.browseFavoritesButton}
            >
              Browse Recipes →
            </Link>
          </section>
        )}
      </main>
    </>
  );
}
