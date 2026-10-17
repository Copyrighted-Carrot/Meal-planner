const mongoose = require("mongoose");
const { isWeekStart } = require('../utils/planDate');

const groceryListSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sourcePlan: { type: mongoose.Schema.Types.ObjectId, ref: "WeeklyPlan", default: null }, // Optional link to a plan
    sourcePlanRevision: { type: Number, min: 1 },
    weekStart: { type: String, validate: { validator: value => value == null || isWeekStart(value), message: 'Week must be a Monday calendar date' } },
    revision: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
    items: [
        {
            key: { type: String, maxlength: 160 },
            name: { type: String, required: true },
            amount: { type: String, default: "" },
            checked: { type: Boolean, default: false },
        },
    ],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
});

groceryListSchema.index({ user: 1, weekStart: 1 }, {
    unique: true,
    partialFilterExpression: { weekStart: { $type: 'string' } },
});

module.exports = mongoose.model("GroceryList", groceryListSchema);
