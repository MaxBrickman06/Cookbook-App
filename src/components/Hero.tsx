export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-content">
        <p className="hero-label">YOUR PERSONAL COOKBOOK</p>

        <h1>
          What are you
          <br />
          cooking today?
        </h1>

        <p className="hero-description">
          Keep your favorite recipes organized, discover something new,
          and always know what&apos;s in your kitchen.
        </p>

        <div className="hero-actions">
          <button className="primary-button">Browse Recipes</button>
          <button className="secondary-button">Add Recipe</button>
        </div>
      </div>
    </section>
  );
}