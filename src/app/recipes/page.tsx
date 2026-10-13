
"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import RecipeCard from "@/components/RecipeCard";
import { recipes } from "@/data/recipes";
import styles from "./page.module.css";

const categories = [
  "All",
  "Breakfast",
  "Lunch",
  "Dinner",
  "Dessert",
];

export default function RecipesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("All");

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch = recipe.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "All" ||
      recipe.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <Navbar />

      <main className={styles.recipesPage}>
        <section className={styles.recipesHeader}>
          <div>
            <p className={styles.sectionLabel}>
              YOUR COLLECTION
            </p>

            <h1>Recipes</h1>

            <p className={styles.recipesIntro}>
              Browse through your collection of favorite recipes.
            </p>
          </div>

          <Link
            href="/recipes/new"
            className={styles.addRecipeButton}
          >
            + Add Recipe
          </Link>
        </section>

        <section className={styles.recipeControls}>
          <div className={styles.searchContainer}>
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search recipes..."
              aria-label="Search recipes"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
            />
          </div>

          <div className={styles.categoryFilters}>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() =>
                  setSelectedCategory(category)
                }
                className={`${styles.categoryButton} ${
                  selectedCategory === category
                    ? styles.active
                    : ""
                }`}
                aria-pressed={selectedCategory === category}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.librarySection}>
          <div className={styles.libraryHeader}>
            <div>
              <h2>All Recipes</h2>

              <span>
                {filteredRecipes.length}{" "}
                {filteredRecipes.length === 1
                  ? "recipe"
                  : "recipes"}
              </span>
            </div>
          </div>

          {filteredRecipes.length > 0 ? (
            <div className={styles.recipeGrid}>
              {filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                />
              ))}
            </div>
          ) : (
            <div className={styles.noResults}>
              <div className={styles.noResultsIcon}>
                ⌕
              </div>

              <h3>No recipes found</h3>

              <p>
                Try a different search or category.
              </p>

              <button
                type="button"
                className={styles.clearSearchButton}
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
