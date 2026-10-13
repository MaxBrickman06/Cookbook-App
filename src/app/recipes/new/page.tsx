
import Link from "next/link";
import styles from "./page.module.css";

export default function NewRecipePage() {
  return (
    <main className={styles.newRecipePage}>
      <Link href="/recipes" className={styles.backLink}>
        ← Back to recipes
      </Link>

      <section className={styles.newRecipeHeader}>
        <p className={styles.sectionLabel}>YOUR COLLECTION</p>
        <h1>Add a Recipe</h1>
        <p>Add a recipe to your personal cookbook.</p>
      </section>

      <form className={styles.recipeForm}>
        <section className={styles.formSection}>
          <div className={styles.formSectionHeader}>
            <h2>Recipe Details</h2>
            <span>01</span>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="title">Recipe Name</label>
            <input
              id="title"
              type="text"
              placeholder="e.g. Creamy Garlic Chicken"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              rows={4}
              placeholder="A short description of your recipe..."
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="category">Category</label>
              <select id="category" defaultValue="">
                <option value="" disabled>Select a category</option>
                <option value="Breakfast">Breakfast</option>
                <option value="Lunch">Lunch</option>
                <option value="Dinner">Dinner</option>
                <option value="Dessert">Dessert</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="cook-time">Cook Time</label>
              <input
                id="cook-time"
                type="text"
                placeholder="e.g. 30 min"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="servings">Servings</label>
              <input
                id="servings"
                type="number"
                min="1"
                placeholder="4"
              />
            </div>
          </div>
        </section>

        <section className={styles.formSection}>
          <div className={styles.formSectionHeader}>
            <h2>Ingredients</h2>
            <span>02</span>
          </div>

          <p className={styles.formSectionDescription}>
            Add everything you&apos;ll need to make this recipe.
          </p>

          <div className={styles.ingredientInputRow}>
            <input type="text" placeholder="Amount" />
            <input type="text" placeholder="Ingredient name" />

            <button
              type="button"
              className={styles.removeIngredientButton}
              aria-label="Remove ingredient"
            >
              ×
            </button>
          </div>

          <button type="button" className={styles.addRowButton}>
            + Add Ingredient
          </button>
        </section>

        <section className={styles.formSection}>
          <div className={styles.formSectionHeader}>
            <h2>Directions</h2>
            <span>03</span>
          </div>

          <p className={styles.formSectionDescription}>
            Walk through the recipe step by step.
          </p>

          <div className={styles.directionInputRow}>
            <span>1</span>
            <textarea
              rows={3}
              placeholder="Describe the first step..."
            />
          </div>

          <button type="button" className={styles.addRowButton}>
            + Add Step
          </button>
        </section>

        <section className={styles.formSection}>
          <div className={styles.formSectionHeader}>
            <h2>Recipe Image</h2>
            <span>04</span>
          </div>

          <div className={styles.imageUpload}>
            <div className={styles.uploadIcon}>↑</div>
            <h3>Upload an image</h3>
            <p>
              Drag and drop an image here, or click to browse.
            </p>
            <button type="button" className={styles.uploadButton}>
              Choose Image
            </button>
          </div>
        </section>

        <div className={styles.formActions}>
          <Link href="/recipes" className={styles.cancelButton}>
            Cancel
          </Link>

          <button type="submit" className={styles.saveRecipeButton}>
            Save Recipe →
          </button>
        </div>
      </form>
    </main>
  );
}
