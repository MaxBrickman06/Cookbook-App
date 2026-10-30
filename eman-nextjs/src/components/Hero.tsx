import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroContent}>
        <p className={styles.heroLabel}>YOUR PERSONAL COOKBOOK</p>

        <h1>
          What are you
          <br />
          cooking today?
        </h1>

        <p className={styles.heroDescription}>
          Keep your favorite recipes organized, discover something new,
          and always know what&apos;s in your kitchen.
        </p>

        <div className={styles.heroActions}>
          <button className={styles.primaryButton}>Browse Recipes</button>
          <button className={styles.secondaryButton}>Add Recipe</button>
        </div>
      </div>
    </section>
  );
}