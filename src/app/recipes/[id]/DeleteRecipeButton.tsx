
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteRecipeButtonProps = {
  recipeId: number;
};

export default function DeleteRecipeButton({
  recipeId,
}: DeleteRecipeButtonProps) {
  const router = useRouter();

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this recipe? This action cannot be undone."
    );

    if (!confirmed) return;

    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete recipe.");
      }

      // Return to the recipe listing after deletion.
      router.push("/recipes");
      router.refresh();
    } catch (error) {
      console.error("Recipe deletion failed:", error);
      setError("Could not delete recipe. Please try again.");
      setIsDeleting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        style={{
          padding: "12px 20px",
          backgroundColor: "#b91c1c",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: isDeleting ? "not-allowed" : "pointer",
          opacity: isDeleting ? 0.6 : 1,
        }}
      >
        {isDeleting ? "Deleting..." : "Delete Recipe"}
      </button>

      {error && (
        <p role="alert" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      )}
    </div>
  );
}
