const express = require("express");
const router = express.Router();
const mealController = require("../controllers/mealController");
const { upload } = require("../config/cloudinary");
const requireAuth = require("../middleware/requireAuth");
const validate = require("../middleware/validate");
const { createMealValidator } = require("../middleware/validators/mealValidator");
const { validateObjectId } = require("../middleware/validators/commonValidator");

// DEBUG ROUTE
router.get("/test-nutrition", mealController.testNutrition);

// Routes
router.get("/", requireAuth, mealController.getUserMeals);

router.post(
    "/",
    requireAuth,
    upload.single('image'),
    createMealValidator,
    validate,
    mealController.createMeal
);

router.put(
    "/:id",
    requireAuth,
    upload.single('image'),
    validateObjectId('id'),
    createMealValidator,
    validate,
    mealController.updateMeal
);

router.delete(
    "/:id",
    requireAuth,
    validateObjectId('id'),
    validate,
    mealController.deleteMeal
);

// Global & Helper Routes
router.get("/global", requireAuth, mealController.getGlobalMeals);
router.post("/import-starter-pack", requireAuth, mealController.importStarterPack);
router.post("/suggest", requireAuth, mealController.suggestMeals);

router.post(
    "/copy/:id",
    requireAuth,
    validateObjectId('id'),
    validate,
    mealController.copyGlobalMeal
);

module.exports = router;
