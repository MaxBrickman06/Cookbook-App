
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createRecipeSchema } from "@/lib/validations/recipe";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseRecipeId(id: string): number | null {
  const recipeId = Number(id);

  if (!Number.isSafeInteger(recipeId) || recipeId < 1) {
    return null;
  }

  return recipeId;
}

// DELETE: Remove a recipe
export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  const { id } = await params;
  const recipeId = parseRecipeId(id);

  if (recipeId === null) {
    return NextResponse.json(
      { error: "Invalid recipe ID" },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.recipe.deleteMany({
      where: {
        id: recipeId,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Recipe not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Recipe deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete recipe:", error);

    return NextResponse.json(
      { error: "Failed to delete recipe" },
      { status: 500 }
    );
  }
}

// PATCH: Update an existing recipe
export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  const { id } = await params;
  const recipeId = parseRecipeId(id);

  if (recipeId === null) {
    return NextResponse.json(
      { error: "Invalid recipe ID" },
      { status: 400 }
    );
  }

  // Parse incoming JSON
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request" },
      { status: 400 }
    );
  }

  // Validate recipe data using our existing Zod schema
  const validation = createRecipeSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        error: "Invalid recipe data",
        details: validation.error.issues,
      },
      { status: 400 }
    );
  }

  const data = validation.data;

  try {
    // Check whether the recipe exists
    const existingRecipe = await prisma.recipe.findUnique({
      where: {
        id: recipeId,
      },
    });

    if (!existingRecipe) {
      return NextResponse.json(
        { error: "Recipe not found" },
        { status: 404 }
      );
    }

    // Update the recipe and replace related records
    const updatedRecipe = await prisma.recipe.update({
      where: {
        id: recipeId,
      },

      data: {
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        cookTime: data.cookTime,
        category: data.category,
        servings: data.servings,

        ingredients: {
          deleteMany: {},
          create: data.ingredients.map((ingredient) => ({
            amount: ingredient.amount,
            name: ingredient.name,
          })),
        },

        directions: {
          deleteMany: {},
          create: data.directions.map((instruction, index) => ({
            stepNumber: index + 1,
            instruction,
          })),
        },
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

    return NextResponse.json(updatedRecipe);
  } catch (error) {
    console.error("Failed to update recipe:", error);

    return NextResponse.json(
      { error: "Failed to update recipe" },
      { status: 500 }
    );
  }
}
