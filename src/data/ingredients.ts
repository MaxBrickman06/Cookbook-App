export type Ingredient = {
  id: number;
  name: string;
  category: string;
  quantity: string;
};

export type ShoppingItem = {
  id: number;
  name: string;
  quantity: string;
};

export const pantryIngredients: Ingredient[] = [
  {
    id: 1,
    name: "Chicken Breast",
    category: "Protein",
    quantity: "2 pieces",
  },
  {
    id: 2,
    name: "Eggs",
    category: "Dairy",
    quantity: "8 eggs",
  },
  {
    id: 3,
    name: "Rice",
    category: "Grains",
    quantity: "2 lbs",
  },
  {
    id: 4,
    name: "Garlic",
    category: "Produce",
    quantity: "1 bulb",
  },
  {
    id: 5,
    name: "Olive Oil",
    category: "Pantry",
    quantity: "1 bottle",
  },
  {
    id: 6,
    name: "Parmesan",
    category: "Dairy",
    quantity: "8 oz",
  },
  {
    id: 7,
    name: "Spinach",
    category: "Produce",
    quantity: "1 bag",
  },
  {
    id: 8,
    name: "Pasta",
    category: "Grains",
    quantity: "1 box",
  },
];

export const shoppingList: ShoppingItem[] = [
  {
    id: 1,
    name: "Heavy Cream",
    quantity: "1 carton",
  },
  {
    id: 2,
    name: "Fresh Basil",
    quantity: "1 bunch",
  },
  {
    id: 3,
    name: "Cherry Tomatoes",
    quantity: "1 container",
  },
];