import Link from "next/link";

export default function NewRecipePage() {
  return (
    <main className="new-recipe-page">
      <Link href="/recipes" className="back-link">
        ← Back to recipes
      </Link>

      <section className="new-recipe-header">
        <p className="section-label">YOUR COLLECTION</p>

        <h1>Add a Recipe</h1>

        <p>
          Add a recipe to your personal cookbook.
        </p>
      </section>

      <form className="recipe-form">
        <section className="form-section">
          <div className="form-section-header">
            <h2>Recipe Details</h2>
            <span>01</span>
          </div>

          <div className="form-group">
            <label htmlFor="title">
              Recipe Name
            </label>

            <input
              id="title"
              type="text"
              placeholder="e.g. Creamy Garlic Chicken"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">
              Description
            </label>

            <textarea
              id="description"
              rows={4}
              placeholder="A short description of your recipe..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">
                Category
              </label>

              <select id="category" defaultValue="">
                <option value="" disabled>
                  Select a category
                </option>
                <option value="Breakfast">
                  Breakfast
                </option>
                <option value="Lunch">
                  Lunch
                </option>
                <option value="Dinner">
                  Dinner
                </option>
                <option value="Dessert">
                  Dessert
                </option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="cook-time">
                Cook Time
              </label>

              <input
                id="cook-time"
                type="text"
                placeholder="e.g. 30 min"
              />
            </div>

            <div className="form-group">
              <label htmlFor="servings">
                Servings
              </label>

              <input
                id="servings"
                type="number"
                min="1"
                placeholder="4"
              />
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-header">
            <h2>Ingredients</h2>
            <span>02</span>
          </div>

          <p className="form-section-description">
            Add everything you'll need to make this recipe.
          </p>

          <div className="ingredient-input-row">
            <input
              type="text"
              placeholder="Amount"
            />

            <input
              type="text"
              placeholder="Ingredient name"
            />

            <button
              type="button"
              className="remove-ingredient-button"
              aria-label="Remove ingredient"
            >
              ×
            </button>
          </div>

          <button
            type="button"
            className="add-row-button"
          >
            + Add Ingredient
          </button>
        </section>

        <section className="form-section">
          <div className="form-section-header">
            <h2>Directions</h2>
            <span>03</span>
          </div>

          <p className="form-section-description">
            Walk through the recipe step by step.
          </p>

          <div className="direction-input-row">
            <span>1</span>

            <textarea
              rows={3}
              placeholder="Describe the first step..."
            />
          </div>

          <button
            type="button"
            className="add-row-button"
          >
            + Add Step
          </button>
        </section>

        <section className="form-section">
          <div className="form-section-header">
            <h2>Recipe Image</h2>
            <span>04</span>
          </div>

          <div className="image-upload">
            <div className="upload-icon">↑</div>

            <h3>Upload an image</h3>

            <p>
              Drag and drop an image here, or click to
              browse.
            </p>

            <button
              type="button"
              className="upload-button"
            >
              Choose Image
            </button>
          </div>
        </section>

        <div className="form-actions">
          <Link
            href="/recipes"
            className="cancel-button"
          >
            Cancel
          </Link>

          <button
            type="submit"
            className="save-recipe-button"
          >
            Save Recipe →
          </button>
        </div>
      </form>
    </main>
  );
}