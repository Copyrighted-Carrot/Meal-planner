const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

const requireAuth = asyncHandler(async (req, res, next) => {
    // Get token from header
    const token = req.header("x-auth-token");

    // Check if not token
    if (!token) {
        return next(new AppError("No token, authorization denied", 401));
    }

    // Verify token before consulting the current account status.
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (err) {
        return next(new AppError("Session expired or invalid. Please sign in again.", 401));
    }
    if (typeof decoded.user?.id !== 'string' || !/^[a-f\d]{24}$/i.test(decoded.user.id) || typeof decoded.exp !== 'number') {
        return next(new AppError("Session expired or invalid. Please sign in again.", 401));
    }
    const account = await User.findById(decoded.user.id).select('isSuspended');
    if (!account || account.isSuspended) {
        return next(new AppError("Account unavailable. Please sign in again.", 401));
    }
    req.user = { id: decoded.user.id };
    next();
});

module.exports = requireAuth;
