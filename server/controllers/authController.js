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
    const result = await authService.login({ email, password });
    // Preserve the limiter and the service's deliberate 401/403 errors.
    loginLimiter.resetKey(email || req.ip);
    res.json(result);
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
