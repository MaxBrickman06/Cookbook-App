
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import RecipeCard from "@/components/RecipeCard";
import { recipes } from "@/data/recipes";

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />

        <section className="recipes-section">
          <div className="section-header">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">
                YOUR COLLECTION
              </p>
              <h2>Featured Recipes</h2>
            </div>

            <a href="/recipes" className="view-all-button">
              View all →
            </a>
          </div>

          <div className="recipe-grid">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
