
"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { getFavoriteIds } from "@/lib/favorites";
import styles from "./page.module.css";

type FavoriteItem = {
  id: number;
  card: ReactNode;
};

type FavoritesCollectionProps = {
  items: FavoriteItem[];
};

export default function FavoritesCollection({
  items,
}: FavoritesCollectionProps) {
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadFavorites = () => {
      setFavoriteIds(getFavoriteIds());
      setIsLoaded(true);
    };

    loadFavorites();

    window.addEventListener(
      "favoritesChanged",
      loadFavorites
    );

    return () => {
      window.removeEventListener(
        "favoritesChanged",
        loadFavorites
      );
    };
  }, []);

  const favoriteItems = items.filter((item) =>
    favoriteIds.includes(item.id)
  );

  if (!isLoaded) {
    return (
      <section className={styles.favoritesSection}>
        <p className={styles.favoritesIntro}>
          Loading your favorites...
        </p>
      </section>
    );
  }

  return favoriteItems.length > 0 ? (
    <section className={styles.favoritesSection}>
      <div className={styles.favoritesSectionHeader}>
        <div>
          <h2>Your Favorites</h2>

          <span>
            {favoriteItems.length}{" "}
            {favoriteItems.length === 1
              ? "saved recipe"
              : "saved recipes"}
          </span>
        </div>
      </div>

      <div className={styles.recipeGrid}>
        {favoriteItems.map((item) => (
          <div key={item.id}>
            {item.card}
          </div>
        ))}
      </div>
    </section>
  ) : (
    <section className={styles.emptyFavorites}>
      <div className={styles.emptyFavoritesIcon}>
        ♡
      </div>

      <h2>No favorites yet</h2>

      <p>
        Recipes you save as favorites will appear here.
      </p>

      <Link
        href="/recipes"
        className={styles.browseFavoritesButton}
      >
        Browse Recipes →
      </Link>
    </section>
  );
}
