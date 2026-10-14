const mealService = require("../services/mealService");
const calculateNutrition = require("../utils/nutritionCalculator");
const asyncHandler = require("../utils/asyncHandler");

const getMeal = asyncHandler(async (req, res) => {
    res.json(await mealService.getMeal(req.user.id, req.params.id));
});

const requireOwnedMeal = asyncHandler(async (req, res, next) => {
    await mealService.getMeal(req.user.id, req.params.id);
    next();
});

const getUserMeals = asyncHandler(async (req, res) => {
    const meals = await mealService.getUserMeals(req.user.id);
    res.json(meals);
});

const createMeal = asyncHandler(async (req, res) => {
    console.log("🥕 createMeal Body:", req.body);
    const meal = await mealService.createMeal(req.user.id, req.body, req.file);
    res.status(201).json(meal);
});

const updateMeal = asyncHandler(async (req, res) => {
    const meal = await mealService.updateMeal(req.user.id, req.params.id, req.body, req.file);
    res.json(meal);
});

const getGlobalMeals = asyncHandler(async (req, res) => {
    const meals = await mealService.getGlobalMeals();
    res.json(meals);
});

const importStarterPack = asyncHandler(async (req, res) => {
    const result = await mealService.importStarterPack(req.user.id);
    res.json(result);
});

const suggestMeals = asyncHandler(async (req, res) => {
    const result = await mealService.suggestMeals(req.body.ingredients);
    res.json(result);
});

const copyGlobalMeal = asyncHandler(async (req, res) => {
    const meal = await mealService.copyGlobalMeal(req.user.id, req.params.id);
    res.status(201).json(meal);
});

const deleteMeal = asyncHandler(async (req, res) => {
    const result = await mealService.deleteMeal(req.user.id, req.params.id);
    res.json(result);
});

const testNutrition = asyncHandler(async (req, res) => {
    const { name, ingredients } = req.query;
    const result = await calculateNutrition(name || "", ingredients || "");
    const nutritionTable = require("../utils/nutritionData");
    res.json({
        input: { name, ingredients },
        result,
        inTable: !!nutritionTable[name?.toLowerCase().trim()],
        envKey: !!process.env.USDA_API_KEY ? "Present" : "Missing"
    });
});

module.exports = {
    getMeal,
    requireOwnedMeal,
    getUserMeals,
    createMeal,
    updateMeal,
    getGlobalMeals,
    importStarterPack,
    suggestMeals,
    copyGlobalMeal,
    deleteMeal,
    testNutrition
};
