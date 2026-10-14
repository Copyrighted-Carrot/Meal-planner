const nutritionTable = require("./nutritionData");
const axios = require("axios");
const logUsage = require("./usageLogger");

const calculateNutrition = async (name, ingredients = []) => {
    if (!name) return { calories: 0, protein: 0, carbs: 0, fat: 0 };

    const cleanName = name.toLowerCase().trim().replace(/ /g, "_");

    // 1. Local Table Lookup (Exact Dish)
    if (nutritionTable[cleanName]) return nutritionTable[cleanName];
    if (nutritionTable[name.toLowerCase().trim()]) return nutritionTable[name.toLowerCase().trim()];

    // 2. Local Table Lookup (Sum of Ingredients)
    let totalNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    let foundIngredients = 0;

    let ingList = [];
    if (Array.isArray(ingredients)) {
        ingList = ingredients;
    } else if (typeof ingredients === 'string') {
        ingList = ingredients.split(',').map(i => i.trim());
    } else {
        ingList = [];
    }

    for (const ing of ingList) {
        if (!ing) continue;
        const cleanIng = ing.toLowerCase().trim().replace(/ /g, "_");

        if (nutritionTable[cleanIng]) {
            const n = nutritionTable[cleanIng];
            totalNutrition.calories += (n.calories || 0);
            totalNutrition.protein += (n.protein || 0);
            totalNutrition.carbs += (n.carbs || 0);
            totalNutrition.fat += (n.fat || 0);
            foundIngredients++;
        } else if (process.env.USDA_API_KEY) {
            // 3. Fallback to USDA API
            try {
                const res = await axios.get(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${ing}&pageSize=1&api_key=${process.env.USDA_API_KEY}`);
                if (res.data.foods && res.data.foods.length > 0) {
                    const food = res.data.foods[0];
                    const nutrients = food.foodNutrients;

                    const getNutrient = (name) => {
                        const found = nutrients.find(n => n.nutrientName.toLowerCase().includes(name));
                        return found ? found.value : 0;
                    };

                    totalNutrition.calories += (getNutrient('energy') || 0);
                    totalNutrition.protein += (getNutrient('protein') || 0);
                    totalNutrition.carbs += (getNutrient('carbohydrate') || 0);
                    totalNutrition.fat += (getNutrient('total lipid') || 0);
                    foundIngredients++;
                    logUsage('USDA', 'General');
                }
            } catch (err) {
                logUsage('USDA', 'General', err.message);
                console.error(`USDA API Error for ${ing}:`, err.message);
            }
        }
    }

    if (foundIngredients > 0) {
        return {
            calories: Math.round(totalNutrition.calories || 0),
            protein: Math.round(totalNutrition.protein || 0),
            carbs: Math.round(totalNutrition.carbs || 0),
            fat: Math.round(totalNutrition.fat || 0)
        };
    }

    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
};

module.exports = calculateNutrition;
