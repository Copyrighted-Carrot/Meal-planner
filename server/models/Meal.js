const mongoose = require("mongoose");

const mealSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ingredients: [String],
  category: { type: String, enum: ["Breakfast", "Lunch", "Dinner", "Snack"], required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Optional for global meals
  imageUrl: { type: String, default: "" }, // Stores Cloudinary URL
  imageCrop: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
  },
  isGlobal: { type: Boolean, default: false },
  nutrition: {
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now },
});

const Meal = mongoose.model("Meal", mealSchema);
module.exports = Meal;
