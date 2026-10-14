const GroceryList = require("../models/GroceryList");
const WeeklyPlan = require("../models/WeeklyPlan");
const AppError = require("../utils/AppError");
const { checkOwnership } = require("../utils/permissions");

const getLists = async (userId) => {
    return await GroceryList.find({ user: userId }).sort({ createdAt: -1 });
};

const createList = async (userId, data) => {
    const { sourcePlanId, items } = data;
    let finalItems = items || [];

    if (sourcePlanId) {
        const plan = await WeeklyPlan.findOne({ _id: sourcePlanId, user: userId });
        // If source plan ID provided but not found/owned
        if (!plan) throw new AppError("Source plan not found", 404);

        // Plan flattening logic
        const allIngredients = [];
        plan.plan.forEach(day => {
            ['breakfast', 'lunch', 'dinner'].forEach(type => {
                if (day[type] && day[type].ingredients) {
                    if (Array.isArray(day[type].ingredients)) {
                        allIngredients.push(...day[type].ingredients);
                    }
                }
            });
        });

        const agg = {};
        allIngredients.forEach(ing => {
            const clean = ing.toLowerCase().trim();
            agg[clean] = true;
        });

        const generatedItems = Object.keys(agg).map(name => ({ name, amount: "", checked: false }));
        finalItems = [...generatedItems, ...(items || [])];
    }

    const newList = new GroceryList({
        user: userId,
        sourcePlan: sourcePlanId,
        items: finalItems,
    });

    return await newList.save();
};

const updateList = async (userId, listId, data) => {
    const list = await GroceryList.findById(listId);
    checkOwnership(list, userId);

    if (data.items) {
        list.items = data.items;
    }

    return await list.save();
};

const deleteList = async (userId, listId) => {
    const list = await GroceryList.findById(listId);
    checkOwnership(list, userId);

    await list.deleteOne();
    return { message: "Grocery List deleted" };
};

module.exports = {
    getLists,
    createList,
    updateList,
    deleteList
};
