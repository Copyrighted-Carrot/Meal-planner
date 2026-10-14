const mongoose = require("mongoose");

const groceryListSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sourcePlan: { type: mongoose.Schema.Types.ObjectId, ref: "WeeklyPlan", default: null }, // Optional link to a plan
    items: [
        {
            name: { type: String, required: true },
            amount: { type: String, default: "" },
            checked: { type: Boolean, default: false },
        },
    ],
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("GroceryList", groceryListSchema);
