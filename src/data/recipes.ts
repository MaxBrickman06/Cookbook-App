export type Ingredient = {
  amount: string;
  name: string;
};

export type Recipe = {
  id: number;
  title: string;
  description: string;
  image: string;
  cookTime: string;
  category: string;
  servings: number;
  ingredients: Ingredient[];
  directions: string[];
};

export const recipes: Recipe[] = [
  {
    id: 1,
    title: "Creamy Chicken Pasta",
    description:
      "Tender chicken tossed with pasta in a rich, creamy sauce.",
    image:
      "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=1200&q=80",
    cookTime: "30 min",
    category: "Dinner",
    servings: 4,
    ingredients: [
      { amount: "2", name: "Chicken breasts" },
      { amount: "12 oz", name: "Pasta" },
      { amount: "1 cup", name: "Heavy cream" },
      { amount: "1/2 cup", name: "Parmesan cheese" },
      { amount: "2 cloves", name: "Garlic" },
      { amount: "2 tbsp", name: "Olive oil" },
      { amount: "1 tsp", name: "Italian seasoning" },
    ],
    directions: [
      "Bring a large pot of salted water to a boil and cook the pasta according to the package instructions.",
      "Season the chicken with salt, pepper, and Italian seasoning.",
      "Heat olive oil in a large pan and cook the chicken until golden brown and fully cooked.",
      "Remove the chicken from the pan and sauté the garlic for about one minute.",
      "Add the heavy cream and Parmesan cheese. Stir until the sauce becomes smooth and creamy.",
      "Slice the chicken and return it to the pan along with the cooked pasta.",
      "Toss everything together and serve immediately.",
    ],
  },
  {
    id: 2,
    title: "Avocado Toast",
    description:
      "Crispy toast topped with creamy avocado and fresh herbs.",
    image:
      "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&w=1200&q=80",
    cookTime: "10 min",
    category: "Breakfast",
    servings: 2,
    ingredients: [
      { amount: "2 slices", name: "Sourdough bread" },
      { amount: "1", name: "Ripe avocado" },
      { amount: "1 tbsp", name: "Lemon juice" },
      { amount: "1 tbsp", name: "Fresh herbs" },
      { amount: "1 tbsp", name: "Olive oil" },
    ],
    directions: [
      "Toast the sourdough bread until golden and crisp.",
      "Mash the avocado in a small bowl with lemon juice, salt, and pepper.",
      "Spread the avocado mixture evenly over the toast.",
      "Top with fresh herbs and a drizzle of olive oil.",
      "Serve immediately.",
    ],
  },
  {
    id: 3,
    title: "Fresh Garden Salad",
    description:
      "A light and refreshing salad packed with fresh vegetables.",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
    cookTime: "15 min",
    category: "Lunch",
    servings: 2,
    ingredients: [
      { amount: "2 cups", name: "Mixed greens" },
      { amount: "1", name: "Cucumber" },
      { amount: "1 cup", name: "Cherry tomatoes" },
      { amount: "1/4", name: "Red onion" },
      { amount: "1/4 cup", name: "Feta cheese" },
      { amount: "2 tbsp", name: "Olive oil" },
    ],
    directions: [
      "Wash and prepare all of the vegetables.",
      "Slice the cucumber, tomatoes, and red onion.",
      "Add the vegetables and mixed greens to a large bowl.",
      "Top with feta cheese.",
      "Drizzle with olive oil and season with salt and pepper.",
      "Toss the salad and serve.",
    ],
  },
];