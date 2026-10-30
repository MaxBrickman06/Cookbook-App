
import Link from "next/link";
import RecipeForm from "./RecipeForm";
import styles from "./page.module.css";

export default function NewRecipePage() {
  return (
    <main className={styles.newRecipePage}>
      <Link href="/recipes" className={styles.backLink}>
        ← Back to recipes
      </Link>

      <section className={styles.newRecipeHeader}>
        <p className={styles.sectionLabel}>
          YOUR COLLECTION
        </p>

        <h1>Add a Recipe</h1>

        <p>Add a recipe to your personal cookbook.</p>
      </section>

      <RecipeForm />
    </main>
  );
}
