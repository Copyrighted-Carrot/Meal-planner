const WeeklyPlan = require("../models/WeeklyPlan");
const Meal = require('../models/Meal');
const AppError = require("../utils/AppError");
const { isWeekStart } = require('../utils/planDate');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const conflict = () => new AppError('This week changed since you loaded it. Reload the plan before saving again.', 409);

const requireWeekStart = weekStart => {
    if (!isWeekStart(weekStart)) throw new AppError('weekStart must be a valid Monday date (YYYY-MM-DD)', 400);
};

const compactPlan = plan => (plan || []).map(day => ({
    day: day.day,
    ...Object.fromEntries(SLOTS.map(slot => {
        const meal = day[slot];
        return [slot, meal ? { _id: meal._id, name: meal.name, ingredients: meal.ingredients || [] } : null];
    })),
}));

const envelope = (document, weekStart, legacyPlan = null) => ({
    _id: document?._id || null,
    weekStart,
    revision: document?.revision || 0,
    plan: document ? compactPlan(document.plan) : [],
    legacyPlan,
});

const getPlan = async (userId, weekStart) => {
    requireWeekStart(weekStart);
    const document = await WeeklyPlan.findOne({ user: userId, weekStart }).lean();
    if (document) return envelope(document, weekStart);

    // Old plans have no reliable date. Do not silently assign them to this week.
    const legacy = await WeeklyPlan.findOne({ user: userId, weekStart: { $exists: false } })
        .sort({ createdAt: -1, _id: -1 }).lean();
    return envelope(null, weekStart, legacy ? compactPlan(legacy.plan) : null);
};

const normalizePlan = plan => {
    if (!Array.isArray(plan) || (plan.length !== 0 && plan.length !== 7)) {
        throw new AppError('Plan must contain all seven days, or be an empty array to clear the week', 400);
    }
    const days = new Map();
    for (const day of plan) {
        if (!day || typeof day !== 'object' || Array.isArray(day)
            || !DAYS.includes(day.day) || days.has(day.day)
            || Object.keys(day).some(key => key !== 'day' && !SLOTS.includes(key))) {
            throw new AppError('Plan must contain each weekday exactly once with only the four meal slots', 400);
        }
        const normalized = { day: day.day };
        for (const slot of SLOTS) {
            const value = day[slot];
            if (value !== null && (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value))) {
                throw new AppError(`Each ${slot} must be a meal ID or null`, 400);
            }
            normalized[slot] = value === null ? null : value.toLowerCase();
        }
        days.set(day.day, normalized);
    }
    return DAYS.filter(day => days.has(day)).map(day => days.get(day));
};

const savePlan = async (userId, { weekStart, revision, plan } = {}) => {
    requireWeekStart(weekStart);
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) {
        throw new AppError('revision must be a non-negative integer', 400);
    }
    const days = normalizePlan(plan);
    const ids = [...new Set(days.flatMap(day => SLOTS.map(slot => day[slot])).filter(Boolean))];
    const meals = ids.length ? await Meal.find({
        _id: { $in: ids },
        $or: [{ user: userId }, { isGlobal: true }],
    }).select('_id name ingredients').lean() : [];
    const byId = new Map(meals.map(meal => [String(meal._id), meal]));
    if (ids.some(id => !byId.has(id))) {
        throw new AppError('One or more selected meals are no longer available. Refresh your meals and try again.', 400);
    }
    const snapshots = days.map(day => ({
        day: day.day,
        ...Object.fromEntries(SLOTS.map(slot => {
            const meal = byId.get(day[slot]);
            return [slot, meal ? { _id: meal._id, name: meal.name, ingredients: [...meal.ingredients] } : null];
        })),
    }));

    let document;
    if (revision === 0) {
        // Ensure the unique index exists before two first saves can race.
        await WeeklyPlan.init();
        try {
            document = await WeeklyPlan.create({ user: userId, weekStart, revision: 1, plan: snapshots, updatedAt: new Date() });
        } catch (error) {
            if (error.code === 11000) throw conflict();
            throw error;
        }
    } else {
        document = await WeeklyPlan.findOneAndUpdate(
            { user: userId, weekStart, revision },
            { $set: { plan: snapshots, updatedAt: new Date() }, $inc: { revision: 1 } },
            { new: true, runValidators: true },
        ).lean();
        if (!document) throw conflict();
    }
    return envelope(document, weekStart);
};

module.exports = { getPlan, savePlan };
