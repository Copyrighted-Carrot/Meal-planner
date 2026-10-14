const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Meal = require("../models/Meal");
const connectDB = require("../config/db");

const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const globalMeals = [
    // Breakfast
    { name: "Avocado Toast", ingredients: ["Bread", "Avocado", "Chili Flakes", "Egg"], category: "Breakfast", isGlobal: true },
    { name: "Oatmeal with Berries", ingredients: ["Oats", "Milk", "Blueberries", "Honey"], category: "Breakfast", isGlobal: true },
    { name: "Greek Yogurt Parfait", ingredients: ["Greek Yogurt", "Granola", "Strawberries"], category: "Breakfast", isGlobal: true },
    { name: "Pancakes", ingredients: ["Flour", "Milk", "Eggs", "Maple Syrup"], category: "Breakfast", isGlobal: true },
    { name: "Breakfast Burrito", ingredients: ["Tortilla", "Eggs", "Cheese", "Black Beans"], category: "Breakfast", isGlobal: true },

    // Lunch
    { name: "Chicken Caesar Salad", ingredients: ["Romaine Lettuce", "Chicken Breast", "Croutons", "Caesar Dressing"], category: "Lunch", isGlobal: true },
    { name: "Grilled Cheese & Tomato Soup", ingredients: ["Bread", "Cheese", "Tomato Soup"], category: "Lunch", isGlobal: true },
    { name: "Quinoa Salad", ingredients: ["Quinoa", "Cucumber", "Feta", "Lemon"], category: "Lunch", isGlobal: true },
    { name: "Turkey Sandwich", ingredients: ["Bread", "Turkey", "Lettuce", "Mayo"], category: "Lunch", isGlobal: true },
    { name: "Vegetable Stir Fry", ingredients: ["Rice", "Broccoli", "Carrots", "Soy Sauce"], category: "Lunch", isGlobal: true },

    // Dinner
    { name: "Spaghetti Bolognese", ingredients: ["Pasta", "Minced Meat", "Tomato Sauce", "Onion"], category: "Dinner", isGlobal: true },
    { name: "Grilled Salmon", ingredients: ["Salmon", "Asparagus", "Lemon", "Garlic"], category: "Dinner", isGlobal: true },
    { name: "Chicken Curry", ingredients: ["Chicken", "Curry Paste", "Coconut Milk", "Rice"], category: "Dinner", isGlobal: true },
    { name: "Tacos", ingredients: ["Taco Shells", "Ground Beef", "Cheese", "Salsa"], category: "Dinner", isGlobal: true },
    { name: "Vegetarian Chili", ingredients: ["Beans", "Tomatoes", "Onion", "Chili Powder"], category: "Dinner", isGlobal: true },

    // Snacks
    { name: "Apple Slices & Peanut Butter", ingredients: ["Apple", "Peanut Butter"], category: "Snack", isGlobal: true },
    { name: "Hummus & Carrots", ingredients: ["Hummus", "Carrots"], category: "Snack", isGlobal: true },
    { name: "Trail Mix", ingredients: ["Nuts", "Dried Fruit", "Chocolate Chips"], category: "Snack", isGlobal: true },
    { name: "Hard Boiled Eggs", ingredients: ["Eggs"], category: "Snack", isGlobal: true },
    { name: "Smoothie", ingredients: ["Banana", "Spinach", "Almond Milk", "Protein Powder"], category: "Snack", isGlobal: true },
];

const seedMeals = async () => {
    try {
        await connectDB();

        // Check if global meals already exist to prevent duplicates
        const existing = await Meal.countDocuments({ isGlobal: true });
        if (existing > 0) {
            console.log("⚠️ Global meals already exist. Skipping seed.");
            process.exit();
        }

        await Meal.insertMany(globalMeals);
        console.log("✅ Global Starter Pack imported successfully!");
        process.exit();
    } catch (error) {
        console.error("❌ Error importing meals:", error);
        process.exit(1);
    }
};

seedMeals();
