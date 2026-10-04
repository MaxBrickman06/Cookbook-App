import Navbar from "@/components/Navbar";
import {
  pantryIngredients,
  shoppingList,
} from "@/data/ingredients";

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

      <main className="pantry-page">
        <section className="pantry-header">
          <div>
            <p className="section-label">YOUR KITCHEN</p>

            <h1>Pantry</h1>

            <p className="pantry-intro">
              Keep track of what you have at home and what
              you need to pick up.
            </p>
          </div>

          <button className="add-ingredient-button">
            + Add Ingredient
          </button>
        </section>

        <section className="pantry-layout">
          <div className="pantry-main">
            <div className="pantry-section-header">
              <div>
                <h2>What You Have</h2>
                <span>
                  {pantryIngredients.length} ingredients
                </span>
              </div>
            </div>

            <div className="pantry-search">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search ingredients..."
              />
            </div>

            <div className="pantry-categories">
              {categories.map((category, index) => (
                <button
                  key={category}
                  className={
                    index === 0
                      ? "pantry-category active"
                      : "pantry-category"
                  }
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="ingredient-grid">
              {pantryIngredients.map((ingredient) => (
                <article
                  key={ingredient.id}
                  className="ingredient-card"
                >
                  <div className="ingredient-icon">
                    {getIngredientIcon(ingredient.category)}
                  </div>

                  <div className="ingredient-info">
                    <span>{ingredient.category}</span>
                    <h3>{ingredient.name}</h3>
                    <p>{ingredient.quantity}</p>
                  </div>

                  <button
                    className="ingredient-menu"
                    aria-label={`Options for ${ingredient.name}`}
                  >
                    •••
                  </button>
                </article>
              ))}
            </div>
          </div>

          <aside className="shopping-list">
            <div className="shopping-header">
              <div>
                <p className="section-label">SHOPPING</p>
                <h2>Need to Buy</h2>
              </div>

              <span>{shoppingList.length}</span>
            </div>

            <div className="shopping-items">
              {shoppingList.map((item) => (
                <label
                  key={item.id}
                  className="shopping-item"
                >
                  <input type="checkbox" />

                  <div>
                    <p>{item.name}</p>
                    <span>{item.quantity}</span>
                  </div>
                </label>
              ))}
            </div>

            <button className="shopping-button">
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