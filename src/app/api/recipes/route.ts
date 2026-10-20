
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createRecipeSchema } from "@/lib/validations/recipe";

// GET: Retrieve all recipes
export async function GET() {
  try {
    const recipes = await prisma.recipe.findMany({
      include: {
        ingredients: true,
        directions: {
          orderBy: {
            stepNumber: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(recipes);
  } catch (error) {
    console.error("Failed to fetch recipes:", error);

    return NextResponse.json(
      { error: "Failed to fetch recipes" },
      { status: 500 }
    );
  }
}

// POST: Create a new recipe
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate incoming data
    const result = createRecipeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Invalid recipe data",
          details: result.error.issues,
        },
        { status: 400 }
      );
    }

    const data = result.data;

    // Save recipe and related records together
    const recipe = await prisma.recipe.create({
      data: {
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        cookTime: data.cookTime,
        category: data.category,
        servings: data.servings,

        ingredients: {
          create: data.ingredients,
        },

        directions: {
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

    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON request" },
        { status: 400 }
      );
    }

    console.error("Failed to create recipe:", error);

    return NextResponse.json(
      { error: "Failed to create recipe" },
      { status: 500 }
    );
  }
}
