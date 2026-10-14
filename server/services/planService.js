const WeeklyPlan = require("../models/WeeklyPlan");
const AppError = require("../utils/AppError");

const getPlan = async (userId) => {
    const plan = await WeeklyPlan.findOne({ user: userId });
    if (!plan) return [];
    return plan.plan;
};

const savePlan = async (userId, planData) => {
    if (!Array.isArray(planData)) {
        throw new AppError("Plan must be an array", 400);
    }

    let weeklyPlan = await WeeklyPlan.findOne({ user: userId });

    if (weeklyPlan) {
        weeklyPlan.plan = planData;
        await weeklyPlan.save();
    } else {
        weeklyPlan = new WeeklyPlan({
            user: userId,
            plan: planData,
        });
        await weeklyPlan.save();
    }

    return weeklyPlan.plan;
};

module.exports = {
    getPlan,
    savePlan,
};
