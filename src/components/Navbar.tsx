export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-content">
        <a href="/" className="logo">
          Cookbook
        </a>

        <div className="nav-links">
            <a href="/">Home</a>
            <a href="/recipes">Recipes</a>
            <a href="/pantry">Pantry</a>
            <a href="/favorites">Favorites</a>
        </div>

        <button
          className="search-button"
          aria-label="Search recipes"
        >
          🔍
        </button>
      </div>
    </nav>
  );
}