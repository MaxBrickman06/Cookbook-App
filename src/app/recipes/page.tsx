
"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import RecipeCard from "@/components/RecipeCard";
import { recipes } from "@/data/recipes";

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

      <main className="recipes-page">
        <section className="recipes-header">
          <div>
            <p className="section-label">YOUR COLLECTION</p>

            <h1>Recipes</h1>

            <p className="recipes-intro">
              Browse through your collection of favorite recipes.
            </p>
          </div>

          <a
            href="/recipes/new"
            className="add-recipe-button"
          >
            + Add Recipe
          </a>
        </section>

        <section className="recipe-controls">
          <div className="search-container">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
            />
          </div>

          <div className="category-filters">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() =>
                  setSelectedCategory(category)
                }
                className={
                  selectedCategory === category
                    ? "category-button active"
                    : "category-button"
                }
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        <section className="library-section">
          <div className="library-header">
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
            <div className="recipe-grid">
              {filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                />
              ))}
            </div>
          ) : (
            <div className="no-results">
              <div className="no-results-icon">
                ⌕
              </div>

              <h3>No recipes found</h3>

              <p>
                Try a different search or category.
              </p>

              <button
                className="clear-search-button"
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
