
import Link from "next/link";
import { notFound } from "next/navigation";

import prisma from "@/lib/prisma";
import RecipeForm from "@/app/recipes/new/RecipeForm";

type EditRecipePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditRecipePage({
  params,
}: EditRecipePageProps) {
  const { id } = await params;
  const recipeId = Number(id);

  if (!Number.isSafeInteger(recipeId) || recipeId < 1) {
    notFound();
  }

  // Retrieve the existing recipe
  const recipe = await prisma.recipe.findUnique({
    where: {
      id: recipeId,
    },
    include: {
      ingredients: true,
      directions: {
        orderBy: {
          stepNumber: "asc",
        },
      },
    },
  });

  if (!recipe) {
    notFound();
  }

  // Convert database records into editable form data
  const initialRecipe = {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    category: recipe.category,
    cookTime: recipe.cookTime,
    servings: recipe.servings,
    imageUrl: recipe.imageUrl,

    ingredients: recipe.ingredients.map((ingredient) => ({
      amount: ingredient.amount,
      name: ingredient.name,
    })),

    directions: recipe.directions.map(
      (direction) => direction.instruction
    ),
  };

  return (
    <main
      style={{
        maxWidth: "900px",
        margin: "40px auto",
        padding: "24px",
      }}
    >
      <Link href={`/recipes/${recipe.id}`}>
        ← Back to Recipe
      </Link>

      <h1>Edit Recipe</h1>

      <p style={{ marginBottom: "32px" }}>
        Editing: {recipe.title}
      </p>

      <RecipeForm initialRecipe={initialRecipe} />
    </main>
  );
}
