
"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";

import Image from "next/image";

import type {
  Ingredient,
  CreateRecipeInput,
} from "@/data/recipes";

import styles from "./page.module.css";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function RecipeForm() {
  // Recipe details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("");

  // Ingredients
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { amount: "", name: "" },
  ]);

  // Directions
  const [directions, setDirections] = useState<string[]>([""]);

  // Image upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission state
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clean up temporary image preview URLs
  useEffect(() => {
    if (!imagePreview) return;

    return () => {
      URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  // -----------------------------
  // Ingredient functions
  // -----------------------------

  function addIngredient() {
    setIngredients((previous) => [
      ...previous,
      { amount: "", name: "" },
    ]);
  }

  function removeIngredient(index: number) {
    setIngredients((previous) =>
      previous.length > 1
        ? previous.filter((_, i) => i !== index)
        : previous
    );
  }

  function updateIngredient(
    index: number,
    field: keyof Ingredient,
    value: string
  ) {
    setIngredients((previous) =>
      previous.map((ingredient, i) =>
        i === index
          ? { ...ingredient, [field]: value }
          : ingredient
      )
    );
  }

  // -----------------------------
  // Direction functions
  // -----------------------------

  function addDirection() {
    setDirections((previous) => [...previous, ""]);
  }

  function removeDirection(index: number) {
    setDirections((previous) =>
      previous.length > 1
        ? previous.filter((_, i) => i !== index)
        : previous
    );
  }

  function updateDirection(index: number, value: string) {
    setDirections((previous) =>
      previous.map((direction, i) =>
        i === index ? value : direction
      )
    );
  }

  // -----------------------------
  // Image functions
  // -----------------------------

  function handleImage(file: File) {
    setError("");
    setSuccess("");

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Please upload a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size === 0 || file.size > MAX_IMAGE_SIZE) {
      setError("Image must be between 1 byte and 5 MB.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    setImageFile(file);
    setImagePreview(previewUrl);
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (file) {
      handleImage(file);
    }

    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (
      !event.currentTarget.contains(
        event.relatedTarget as Node
      )
    ) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];

    if (file) {
      handleImage(file);
    }
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
  }

  // -----------------------------
  // Validate and submit recipe
  // -----------------------------

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSubmitting) return;

    setError("");
    setSuccess("");

    const cleanedIngredients = ingredients.map(
      (ingredient) => ({
        amount: ingredient.amount.trim(),
        name: ingredient.name.trim(),
      })
    );

    const cleanedDirections = directions.map(
      (direction) => direction.trim()
    );

    if (!title.trim()) {
      setError("Please enter a recipe name.");
      return;
    }

    if (!description.trim()) {
      setError("Please enter a recipe description.");
      return;
    }

    if (!category || !cookTime.trim()) {
      setError("Please complete all recipe details.");
      return;
    }

    const parsedServings = Number(servings);

    if (
      !servings.trim() ||
      !Number.isInteger(parsedServings) ||
      parsedServings < 1
    ) {
      setError("Servings must be a positive whole number.");
      return;
    }

    if (
      cleanedIngredients.length === 0 ||
      cleanedIngredients.some(
        (ingredient) =>
          !ingredient.amount || !ingredient.name
      )
    ) {
      setError("Please complete all ingredient fields.");
      return;
    }

    if (
      cleanedDirections.length === 0 ||
      cleanedDirections.some(
        (direction) => !direction
      )
    ) {
      setError("Please complete all cooking directions.");
      return;
    }

    if (!imageFile) {
      setError("Please upload a recipe image.");
      return;
    }

    const recipeData: Omit<CreateRecipeInput, "image"> = {
      title: title.trim(),
      description: description.trim(),
      category,
      cookTime: cookTime.trim(),
      servings: parsedServings,
      ingredients: cleanedIngredients,
      directions: cleanedDirections,
    };

    setIsSubmitting(true);

    try {
      // Step 1: Upload image to local storage
      const formData = new FormData();
      formData.append("image", imageFile);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(
          uploadResult.error ?? "Failed to upload image."
        );
      }

      const imageUrl: string = uploadResult.imageUrl;

      // Step 2: Save recipe to PostgreSQL
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...recipeData,
          imageUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Failed to save recipe."
        );
      }

      console.log("Recipe saved successfully:", result);

      setSuccess("Recipe saved successfully!");

      // Reset form
      setTitle("");
      setDescription("");
      setCategory("");
      setCookTime("");
      setServings("");
      setIngredients([{ amount: "", name: "" }]);
      setDirections([""]);
      setImageFile(null);
      setImagePreview(null);

    } catch (error) {
      console.error("Error saving recipe:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className={styles.recipeForm}
      onSubmit={handleSubmit}
    >
      {/* Recipe Details */}
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
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="description">Description</label>

          <textarea
            id="description"
            rows={4}
            placeholder="A short description of your recipe..."
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            required
          />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="category">Category</label>

            <select
              id="category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              required
            >
              <option value="" disabled>
                Select a category
              </option>

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
              value={cookTime}
              onChange={(event) =>
                setCookTime(event.target.value)
              }
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="servings">Servings</label>

            <input
              id="servings"
              type="number"
              min="1"
              step="1"
              placeholder="4"
              value={servings}
              onChange={(event) =>
                setServings(event.target.value)
              }
              required
            />
          </div>
        </div>
      </section>

      {/* Ingredients */}
      <section className={styles.formSection}>
        <div className={styles.formSectionHeader}>
          <h2>Ingredients</h2>
          <span>02</span>
        </div>

        <p className={styles.formSectionDescription}>
          Add everything you&apos;ll need to make this recipe.
        </p>

        {ingredients.map((ingredient, index) => (
          <div
            key={index}
            className={styles.ingredientInputRow}
            style={{ marginBottom: "10px" }}
          >
            <input
              type="text"
              placeholder="Amount"
              aria-label={`Amount for ingredient ${index + 1}`}
              value={ingredient.amount}
              onChange={(event) =>
                updateIngredient(
                  index,
                  "amount",
                  event.target.value
                )
              }
              required
            />

            <input
              type="text"
              placeholder="Ingredient name"
              aria-label={`Name of ingredient ${index + 1}`}
              value={ingredient.name}
              onChange={(event) =>
                updateIngredient(
                  index,
                  "name",
                  event.target.value
                )
              }
              required
            />

            <button
              type="button"
              className={styles.removeIngredientButton}
              aria-label={`Remove ingredient ${index + 1}`}
              onClick={() => removeIngredient(index)}
              disabled={ingredients.length === 1}
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          className={styles.addRowButton}
          onClick={addIngredient}
        >
          + Add Ingredient
        </button>
      </section>

      {/* Directions */}
      <section className={styles.formSection}>
        <div className={styles.formSectionHeader}>
          <h2>Directions</h2>
          <span>03</span>
        </div>

        <p className={styles.formSectionDescription}>
          Walk through the recipe step by step.
        </p>

        {directions.map((direction, index) => (
          <div
            key={index}
            className={styles.directionInputRow}
            style={{ marginBottom: "12px" }}
          >
            <span>{index + 1}</span>

            <div>
              <textarea
                rows={3}
                placeholder={`Describe step ${index + 1}...`}
                aria-label={`Direction step ${index + 1}`}
                value={direction}
                onChange={(event) =>
                  updateDirection(
                    index,
                    event.target.value
                  )
                }
                required
              />

              <button
                type="button"
                className={styles.addRowButton}
                onClick={() => removeDirection(index)}
                disabled={directions.length === 1}
              >
                Remove Step
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          className={styles.addRowButton}
          onClick={addDirection}
        >
          + Add Step
        </button>
      </section>

      {/* Image Upload */}
      <section className={styles.formSection}>
        <div className={styles.formSectionHeader}>
          <h2>Recipe Image</h2>
          <span>04</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          aria-label="Upload recipe image"
          style={{ display: "none" }}
        />

        <div
          className={`${styles.imageUpload} ${
            isDragging ? styles.dragActive : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {imagePreview ? (
            <div className={styles.imagePreviewContainer}>
              <Image
                src={imagePreview}
                alt="Recipe image preview"
                width={500}
                height={300}
                unoptimized
                className={styles.imagePreview}
              />

              <p>{imageFile?.name}</p>

              <button
                type="button"
                className={styles.uploadButton}
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                Change Image
              </button>

              <button
                type="button"
                className={styles.removeImageButton}
                onClick={removeImage}
              >
                Remove Image
              </button>
            </div>
          ) : (
            <>
              <div className={styles.uploadIcon}>↑</div>

              <h3>Upload an image</h3>

              <p>
                Drag and drop an image here, or click to browse.
                JPG, PNG, or WebP, up to 5 MB.
              </p>

              <button
                type="button"
                className={styles.uploadButton}
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                Choose Image
              </button>
            </>
          )}
        </div>
      </section>

      {/* Validation Error */}
      {error && (
        <p role="alert" className={styles.formError}>
          {error}
        </p>
      )}

      {/* Success Message */}
      {success && (
        <p role="status">
          {success}
        </p>
      )}

      {/* Form Actions */}
      <div className={styles.formActions}>
        <button
          type="submit"
          className={styles.saveRecipeButton}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Saving Recipe..."
            : "Save Recipe →"}
        </button>
      </div>
    </form>
  );
}
