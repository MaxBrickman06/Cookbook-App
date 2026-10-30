
"use client";

import { useState, type ReactNode } from "react";
import styles from "./RecipeExplorer.module.css";

type RecipeItem = {
  id: number;
  title: string;
  category: string;
  card: ReactNode;
};

type RecipeExplorerProps = {
  items: RecipeItem[];
};

const categories = [
  "All",
  "Breakfast",
  "Lunch",
  "Dinner",
  "Dessert",
];

export default function RecipeExplorer({
  items,
}: RecipeExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("All");

  const filteredRecipes = items.filter((item) => {
    const matchesSearch = item.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "All" ||
      item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  function clearFilters() {
    setSearchQuery("");
    setSelectedCategory("All");
  }

  return (
    <>
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
            {filteredRecipes.map((item) => (
              <div key={item.id}>
                {item.card}
              </div>
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
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        )}
      </section>
    </>
  );
}
