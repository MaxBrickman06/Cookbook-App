
import Link from "next/link";
import Navbar from "@/components/Navbar";
import RecipeCard from "@/components/RecipeCard";
import RecipeExplorer from "./RecipeExplorer/RecipeExplorer";
import { recipes } from "@/data/recipes";
import styles from "./page.module.css";

export default function RecipesPage() {
  const recipeItems = recipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    category: recipe.category,
    card: <RecipeCard key={recipe.id} recipe={recipe} />,
  }));

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

        <RecipeExplorer items={recipeItems} />
      </main>
    </>
  );
}
