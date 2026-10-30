
import Navbar from "@/components/Navbar";
import {
  pantryIngredients,
  shoppingList,
} from "@/data/ingredients";
import styles from "./page.module.css";

const categories = [
  "All",
  "Produce",
  "Protein",
  "Dairy",
  "Grains",
  "Pantry",
];

export default function PantryPage() {
  return (
    <>
      <Navbar />

      <main className={styles.pantryPage}>
        <section className={styles.pantryHeader}>
          <div>
            <p className={styles.sectionLabel}>
              YOUR KITCHEN
            </p>

            <h1>Pantry</h1>

            <p className={styles.pantryIntro}>
              Keep track of what you have at home and what
              you need to pick up.
            </p>
          </div>

          <button
            type="button"
            className={styles.addIngredientButton}
          >
            + Add Ingredient
          </button>
        </section>

        <section className={styles.pantryLayout}>
          <div className={styles.pantryMain}>
            <div className={styles.pantrySectionHeader}>
              <div>
                <h2>What You Have</h2>
                <span>
                  {pantryIngredients.length} ingredients
                </span>
              </div>
            </div>

            <div className={styles.pantrySearch}>
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search ingredients..."
                aria-label="Search ingredients"
              />
            </div>

            <div className={styles.pantryCategories}>
              {categories.map((category, index) => (
                <button
                  key={category}
                  type="button"
                  className={`${styles.pantryCategory} ${
                    index === 0 ? styles.active : ""
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className={styles.ingredientGrid}>
              {pantryIngredients.map((ingredient) => (
                <article
                  key={ingredient.id}
                  className={styles.ingredientCard}
                >
                  <div className={styles.ingredientIcon}>
                    {getIngredientIcon(ingredient.category)}
                  </div>

                  <div className={styles.ingredientInfo}>
                    <span>{ingredient.category}</span>
                    <h3>{ingredient.name}</h3>
                    <p>{ingredient.quantity}</p>
                  </div>

                  <button
                    type="button"
                    className={styles.ingredientMenu}
                    aria-label={`Options for ${ingredient.name}`}
                  >
                    •••
                  </button>
                </article>
              ))}
            </div>
          </div>

          <aside className={styles.shoppingList}>
            <div className={styles.shoppingHeader}>
              <div>
                <p className={styles.sectionLabel}>
                  SHOPPING
                </p>
                <h2>Need to Buy</h2>
              </div>

              <span>{shoppingList.length}</span>
            </div>

            <div className={styles.shoppingItems}>
              {shoppingList.map((item) => (
                <label
                  key={item.id}
                  className={styles.shoppingItem}
                >
                  <input type="checkbox" />

                  <div>
                    <p>{item.name}</p>
                    <span>{item.quantity}</span>
                  </div>
                </label>
              ))}
            </div>

            <button
              type="button"
              className={styles.shoppingButton}
            >
              View Shopping List →
            </button>
          </aside>
        </section>
      </main>
    </>
  );
}

function getIngredientIcon(category: string) {
  switch (category) {
    case "Produce":
      return "🥬";
    case "Protein":
      return "🍗";
    case "Dairy":
      return "🥛";
    case "Grains":
      return "🌾";
    case "Pantry":
      return "🫙";
    default:
      return "🥘";
  }
}
