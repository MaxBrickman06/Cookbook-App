
import Navbar from "@/components/Navbar";
import RecipeCard from "@/components/RecipeCard";
import { recipes } from "@/data/recipes";
import FavoritesCollection from "./FavoritesCollection";
import styles from "./page.module.css";

export default function FavoritesPage() {
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
