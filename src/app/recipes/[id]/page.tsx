
import Link from "next/link";
import { notFound } from "next/navigation";
import { recipes } from "@/data/recipes";
import FavoriteRecipeButton from "./FavoriteRecipeButton";
import IngredientAvailability from "./IngredientAvailability";
import styles from "./page.module.css";
import Image from "next/image";

type RecipePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RecipePage({
  params,
}: RecipePageProps) {
  const { id } = await params;

  const recipe = recipes.find(
    (item) => item.id === Number(id)
  );

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
            src={recipe.image}
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
        </div>
      </section>

      <section className={styles.recipeDetailContent}>
        <IngredientAvailability
          ingredients={recipe.ingredients}
        />

        <div className={styles.directionsSection}>
          <h2>Directions</h2>

          <div className={styles.directionsList}>
            {recipe.directions.map((direction, index) => (
              <div
                key={index}
                className={styles.directionStep}
              >
                <span>{index + 1}</span>
                <p>{direction}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
