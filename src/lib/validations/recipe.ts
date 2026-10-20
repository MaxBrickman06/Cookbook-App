
import { z } from "zod";

export const createRecipeSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),

  description: z.string().trim().min(1, "Description is required"),
  
  imageUrl: z
    .string()
    .regex(
        /^\/uploads\/[a-f0-9-]+\.(jpg|png|webp)$/,
        "Invalid local image path"
    ),

  cookTime: z.string().trim().min(1, "Cook time is required"),

  category: z.string().trim().min(1, "Category is required"),

  servings: z.number().int().positive(),

  ingredients: z.array(
    z.object({
      amount: z.string().trim().min(1),
      name: z.string().trim().min(1),
    })
  ).min(1, "At least one ingredient is required"),

  directions: z.array(
    z.string().trim().min(1)
  ).min(1, "At least one direction is required"),
});

export type CreateRecipeData = z.infer<typeof createRecipeSchema>;
