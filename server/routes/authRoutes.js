const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const requireAuth = require("../middleware/requireAuth");
const validate = require("../middleware/validate");
const { registerValidator, loginValidator } = require("../middleware/validators/authValidator");

router.post("/google", authController.googleLogin);

const rateLimit = require("express-rate-limit");
const loginLimiter = require("../middleware/loginLimiter");

router.post(
    "/register",
    // loginLimiter,
    registerValidator,
    validate,
    authController.register
);

router.post(
    "/login",
    loginLimiter,
    loginValidator,
    validate,
    authController.login
);

router.get("/user", requireAuth, authController.getUser);

module.exports = router;
