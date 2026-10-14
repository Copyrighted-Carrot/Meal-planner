const Meal = require("../models/Meal");
const calculateNutrition = require("../utils/nutritionCalculator");
const AppError = require("../utils/AppError");
const { checkOwnership } = require("../utils/permissions");
const logUsage = require("../utils/usageLogger");

const getUserMeals = async (userId) => {
    return await Meal.find({ user: userId }).sort({ createdAt: -1 });
};

const createMeal = async (userId, data, file) => {
    const { name, ingredients, category, cropX, cropY, cropWidth, cropHeight } = data;
    let imageUrl = file ? file.path : "";

    // Parse imageCrop from individual fields
    let parsedCrop = { x: 0, y: 0, width: 0, height: 0 };
    if (cropX !== undefined) {
        parsedCrop = {
            x: Number(cropX),
            y: Number(cropY),
            width: Number(cropWidth),
            height: Number(cropHeight)
        };
        console.log("🥕 Constructed parsedCrop:", parsedCrop);
    }

    if (file) logUsage('Cloudinary', 'Upload', null, file.size);

    const nutrition = await calculateNutrition(name, ingredients);

    const newMeal = new Meal({
        name,
        ingredients: Array.isArray(ingredients)
            ? ingredients
            : (ingredients || "").split(',').map(i => i.trim()).filter(i => i.length > 0),
        category,
        imageUrl,
        imageCrop: parsedCrop,
        user: userId,
        nutrition
    });

    return await newMeal.save();
};

const updateMeal = async (userId, mealId, data, file) => {
    const meal = await Meal.findById(mealId);
    checkOwnership(meal, userId);

    const { name, ingredients, category, cropX, cropY, cropWidth, cropHeight } = data;

    if (name) meal.name = name;
    if (category) meal.category = category;
    if (ingredients) {
        meal.ingredients = Array.isArray(ingredients) ? ingredients : ingredients.split(',').map(i => i.trim());
    }

    if (file) {
        meal.imageUrl = file.path;
        logUsage('Cloudinary', 'Upload', null, file.size);
    }

    if (cropX !== undefined) {
        meal.imageCrop = {
            x: Number(cropX),
            y: Number(cropY),
            width: Number(cropWidth),
            height: Number(cropHeight)
        };
    }

    if (name || ingredients) {
        meal.nutrition = await calculateNutrition(meal.name, meal.ingredients);
    }

    return await meal.save();
};

const getGlobalMeals = async () => {
    return await Meal.find({ isGlobal: true });
};

const importStarterPack = async (userId) => {
    const globalMeals = await Meal.find({ isGlobal: true });
    if (globalMeals.length === 0) throw new AppError("No global meals found", 404);

    const mealsToInsert = await Promise.all(globalMeals.map(async (meal) => ({
        name: meal.name,
        ingredients: meal.ingredients,
        category: meal.category,
        imageUrl: meal.imageUrl,
        user: userId,
        isGlobal: false,
        nutrition: (!meal.nutrition || meal.nutrition.calories === 0)
            ? await calculateNutrition(meal.name, meal.ingredients)
            : meal.nutrition
    })));

    await Meal.insertMany(mealsToInsert);
    return { message: `${mealsToInsert.length} meals imported successfully!` };
};

const suggestMeals = async (ingredients) => {
    if (!ingredients) throw new AppError("Please provide ingredients", 400);

    const userIngredients = (Array.isArray(ingredients) ? ingredients : ingredients.split(","))
        .map((i) => i.trim().toLowerCase())
        .filter((i) => i.length > 0);

    const globalMeals = await Meal.find({ isGlobal: true });

    const suggestions = globalMeals
        .map((meal) => {
            const mealIngredients = meal.ingredients.map((i) => i.toLowerCase());
            const matchCount = userIngredients.reduce((count, userIng) => {
                return count + (mealIngredients.some((mealIng) => mealIng.includes(userIng)) ? 1 : 0);
            }, 0);

            return { ...meal.toObject(), matchCount };
        })
        .filter((meal) => meal.matchCount > 0)
        .sort((a, b) => b.matchCount - a.matchCount)
        .slice(0, 5);

    return suggestions;
};

const copyGlobalMeal = async (userId, mealId) => {
    const meal = await Meal.findById(mealId);
    if (!meal) throw new AppError("Meal not found", 404);

    const newMeal = new Meal({
        name: meal.name,
        ingredients: meal.ingredients,
        category: meal.category,
        imageUrl: meal.imageUrl,
        user: userId,
        isGlobal: false,
        nutrition: (!meal.nutrition || meal.nutrition.calories === 0)
            ? await calculateNutrition(meal.name, meal.ingredients)
            : meal.nutrition
    });

    return await newMeal.save();
};

const deleteMeal = async (userId, mealId) => {
    const meal = await Meal.findById(mealId);
    checkOwnership(meal, userId);

    await meal.deleteOne();

    if (meal.imageUrl) logUsage('Cloudinary', 'Delete', null, 0, true);

    return { message: "Meal deleted" };
};

module.exports = {
    getUserMeals,
    createMeal,
    updateMeal,
    getGlobalMeals,
    importStarterPack,
    suggestMeals,
    copyGlobalMeal,
    deleteMeal
};
