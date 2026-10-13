import Link from "next/link";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import RecipeCard from "@/components/RecipeCard";
import { recipes } from "@/data/recipes";
import styles from "./page.module.css";

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />

        <section className={styles.recipesSection}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionLabel}>
                YOUR COLLECTION
              </p>

              <h2>Featured Recipes</h2>
            </div>

            <Link
              href="/recipes"
              className={styles.viewAllButton}
            >
              View all →
            </Link>
          </div>

          <div className={styles.recipeGrid}>
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
              />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}