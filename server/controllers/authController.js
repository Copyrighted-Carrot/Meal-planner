const authService = require("../services/authService");
const asyncHandler = require("../utils/asyncHandler");
const loginLimiter = require("../middleware/loginLimiter");

const googleLogin = asyncHandler(async (req, res) => {
    const { credential } = req.body;
    const result = await authService.googleLogin(credential);
    res.json(result);
});

const register = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const result = await authService.register({ name, email, password });
    res.json(result);
});

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await authService.login({ email, password });

        // RESET Rate Limit on Success
        loginLimiter.resetKey(email || req.ip);

        res.json(result);
    } catch (error) {
        // 1. User Not Found Case (Don't reveal too much usually, but user requested strict distinction)
        if (error.message === "User not found") {
            throw new Error("User does not exist! Please register via the link below.");
        }

        // 2. Rate Limit Feedback for Invalid Password
        if (req.rateLimit) {
            const attemptsLeft = req.rateLimit.remaining;

            if (attemptsLeft === 0) {
                throw new Error("Invalid Credentials. Last chance before locking yourself for 15 minutes!");
            }

            throw new Error(`Invalid Credentials. You have ${attemptsLeft} attempts left.`);
        }
        throw error; // Rethrow original if no rate limit info
    }
});

const getUser = asyncHandler(async (req, res) => {
    const user = await authService.getUser(req.user.id);
    res.json(user);
});

module.exports = {
    googleLogin,
    register,
    login,
    getUser,
};
