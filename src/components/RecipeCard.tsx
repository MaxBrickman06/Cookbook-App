import Link from "next/link";
import type { Recipe } from "@/data/recipes";
import FavoriteButton from "./FavoriteButton";
import styles from "./RecipeCard.module.css";
import Image from "next/image";

type RecipeCardProps = {
  recipe: Recipe;
};

export default function RecipeCard({
  recipe,
}: RecipeCardProps) {
  return (
    <article className={styles.recipeCard}>
      <div className={styles.recipeImageContainer}>
        <Image
          src={recipe.image}
          alt={recipe.title}
          fill
          sizes="(max-width: 800px) 100vw, 33vw"
          className={styles.recipeImage}
        />

        <FavoriteButton recipeId={recipe.id} />
      </div>

      <div className={styles.recipeContent}>
        <div className={styles.recipeMeta}>
          <span>{recipe.category}</span>
          <span>{recipe.cookTime}</span>
        </div>

        <h3>{recipe.title}</h3>

        <p>{recipe.description}</p>

        <Link
          href={`/recipes/${recipe.id}`}
          className={styles.viewRecipeButton}
        >
          View Recipe →
        </Link>
      </div>
    </article>
  );
}