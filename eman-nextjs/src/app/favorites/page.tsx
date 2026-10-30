
import Navbar from "@/components/Navbar";
import RecipeCard from "@/components/RecipeCard";
import FavoritesCollection from "./FavoritesCollection";
import prisma from "@/lib/prisma";
import type { Recipe } from "@/data/recipes";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  // Retrieve recipes from PostgreSQL
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

  // Convert database recipes into our frontend Recipe type
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

  // Pass recipe cards to FavoritesCollection
  const items = recipes.map((recipe) => ({
    id: recipe.id,
    card: <RecipeCard key={recipe.id} recipe={recipe} />,
  }));

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

        <FavoritesCollection items={items} />
      </main>
    </>
  );
}
