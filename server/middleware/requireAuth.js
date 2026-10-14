const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");

const requireAuth = (req, res, next) => {
    // Get token from header
    const token = req.header("x-auth-token");

    // Check if not token
    if (!token) {
        return next(new AppError("No token, authorization denied", 401));
    }

    // Verify token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        next(new AppError("Token is not valid", 401));
    }
};

module.exports = requireAuth;
