import Link from "next/link";
import styles from "./Navbar.module.css";

export default function Navbar() {
  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarContent}>
        <Link href="/" className={styles.logo}>
          Cookbook
        </Link>

        <div className={styles.navLinks}>
          <Link href="/">Home</Link>
          <Link href="/recipes">Recipes</Link>
          <Link href="/pantry">Pantry</Link>
          <Link href="/favorites">Favorites</Link>
        </div>

        <button
          type="button"
          className={styles.searchButton}
          aria-label="Search recipes"
        >
          🔍
        </button>
      </div>
    </nav>
  );
}