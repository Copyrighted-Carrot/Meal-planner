const mongoose = require("mongoose");

const weeklyPlanSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    plan: [
        {
            day: { type: String, required: true },
            breakfast: { type: Object, default: null },
            lunch: { type: Object, default: null },
            dinner: { type: Object, default: null },
        },
    ],
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("WeeklyPlan", weeklyPlanSchema);
