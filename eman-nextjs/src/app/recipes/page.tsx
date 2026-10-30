
import Link from "next/link";
import Navbar from "@/components/Navbar";
import RecipeCard from "@/components/RecipeCard";
import RecipeExplorer from "./RecipeExplorer/RecipeExplorer";
import prisma from "@/lib/prisma";
import type { Recipe } from "@/data/recipes";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  // Fetch all recipes from PostgreSQL
  const databaseRecipes = await prisma.recipe.findMany({
    include: {
      ingredients: true,
      directions: {
        orderBy: {
          stepNumber: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Convert database records into the format
  // expected by our existing RecipeCard component
  const recipes: Recipe[] = databaseRecipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    image: recipe.imageUrl,
    cookTime: recipe.cookTime,
    category: recipe.category,
    servings: recipe.servings,

    ingredients: recipe.ingredients.map((ingredient) => ({
      amount: ingredient.amount,
      name: ingredient.name,
    })),

    directions: recipe.directions.map(
      (direction) => direction.instruction
    ),
  }));

  // Prepare recipe cards for RecipeExplorer
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
