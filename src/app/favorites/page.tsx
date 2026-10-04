
"use client";

import Navbar from "@/components/Navbar";
import RecipeCard from "@/components/RecipeCard";
import { recipes } from "@/data/recipes";
import { getFavoriteIds } from "@/lib/favorites";
import { useEffect, useState } from "react";

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

      <main className="favorites-page">
        <section className="favorites-header">
          <div>
            <p className="section-label">YOUR COLLECTION</p>

            <h1>Favorites</h1>

            <p className="favorites-intro">
              Keep the recipes you love most in one place.
            </p>
          </div>
        </section>

        {favoriteRecipes.length > 0 ? (
          <section className="favorites-section">
            <div className="favorites-section-header">
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

            <div className="recipe-grid">
              {favoriteRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="empty-favorites">
            <div className="empty-favorites-icon">
              ♡
            </div>

            <h2>No favorites yet</h2>

            <p>
              Recipes you save as favorites will appear
              here.
            </p>

            <a
              href="/recipes"
              className="browse-favorites-button"
            >
              Browse Recipes →
            </a>
          </section>
        )}
      </main>
    </>
  );
}