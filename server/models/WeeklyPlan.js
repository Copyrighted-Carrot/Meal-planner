const mongoose = require("mongoose");
const { isWeekStart } = require('../utils/planDate');

const mealSnapshotSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    ingredients: { type: [String], default: [] },
}, { _id: false });

const daySchema = new mongoose.Schema({
    day: { type: String, required: true, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    breakfast: { type: mealSnapshotSchema, default: null },
    lunch: { type: mealSnapshotSchema, default: null },
    dinner: { type: mealSnapshotSchema, default: null },
    snack: { type: mealSnapshotSchema, default: null },
}, { _id: false });

const weeklyPlanSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Undated documents remain available for an explicit copy into a chosen week.
    weekStart: { type: String, validate: { validator: value => value == null || isWeekStart(value), message: 'Week must be a Monday calendar date' } },
    revision: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
    plan: { type: [daySchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
});

weeklyPlanSchema.index({ user: 1, weekStart: 1 }, {
    unique: true,
    partialFilterExpression: { weekStart: { $type: 'string' } },
});

module.exports = mongoose.model("WeeklyPlan", weeklyPlanSchema);
