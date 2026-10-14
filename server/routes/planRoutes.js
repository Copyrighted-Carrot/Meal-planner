const express = require("express");
const router = express.Router();
const planController = require("../controllers/planController");
const requireAuth = require("../middleware/requireAuth");
const validate = require("../middleware/validate");
const { planValidator } = require("../middleware/validators/planValidator");

router.get("/", requireAuth, planController.getPlan);

router.post(
    "/",
    requireAuth,
    planValidator,
    validate,
    planController.savePlan
);

module.exports = router;
