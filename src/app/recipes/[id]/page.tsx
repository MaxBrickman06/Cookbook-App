
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import prisma from "@/lib/prisma";
import FavoriteRecipeButton from "./FavoriteRecipeButton";
import IngredientAvailability from "./IngredientAvailability";
import styles from "./page.module.css";
import DeleteRecipeButton from "./DeleteRecipeButton";

type RecipePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RecipePage({
  params,
}: RecipePageProps) {
  const { id } = await params;

  // Convert the URL parameter to a numeric database ID.
  const recipeId = Number(id);

  if (!Number.isSafeInteger(recipeId) || recipeId < 1) {
    notFound();
  }

  // Retrieve the recipe from PostgreSQL.
  const recipe = await prisma.recipe.findUnique({
    where: {
      id: recipeId,
    },
    include: {
      ingredients: true,
      directions: {
        orderBy: {
          stepNumber: "asc",
        },
      },
    },
  });

  // Show the 404 page if the recipe doesn't exist.
  if (!recipe) {
    notFound();
  }

  return (
    <main className={styles.recipeDetailPage}>
      <Link href="/recipes" className={styles.backLink}>
        ← Back to recipes
      </Link>

      <section className={styles.recipeDetailHero}>
        <div className={styles.recipeDetailImageContainer}>
          <Image
            src={recipe.imageUrl}
            alt={recipe.title}
            fill
            sizes="(max-width: 800px) 100vw, 55vw"
            className={styles.recipeDetailImage}
          />
        </div>

        <div className={styles.recipeDetailInfo}>
          <div className={styles.recipeMeta}>
            <span>{recipe.category}</span>
            <span>{recipe.cookTime}</span>
          </div>

          <h1>{recipe.title}</h1>

          <p className={styles.recipeDetailDescription}>
            {recipe.description}
          </p>

          <div className={styles.recipeStats}>
            <div>
              <strong>{recipe.cookTime}</strong>
              <span>Cook time</span>
            </div>

            <div>
              <strong>{recipe.servings}</strong>
              <span>Servings</span>
            </div>
          </div>

          <FavoriteRecipeButton recipeId={recipe.id} />
          <Link
            href={`/recipes/${recipe.id}/edit`}
            style={{
              display: "inline-block",
              padding: "12px 20px",
              backgroundColor: "#2563eb",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              marginTop: "12px",
              marginBottom: "12px",
            }}
          >
            Edit Recipe
          </Link>
          <DeleteRecipeButton recipeId={recipe.id} />
        </div>
      </section>

      <section className={styles.recipeDetailContent}>
        <IngredientAvailability
          ingredients={recipe.ingredients.map((ingredient) => ({
            amount: ingredient.amount,
            name: ingredient.name,
          }))}
        />

        <div className={styles.directionsSection}>
          <h2>Directions</h2>

          <div className={styles.directionsList}>
            {recipe.directions.map((direction) => (
              <div
                key={direction.id}
                className={styles.directionStep}
              >
                <span>{direction.stepNumber}</span>
                <p>{direction.instruction}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
