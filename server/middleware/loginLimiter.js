const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit per email address (10 attempts)
    keyGenerator: (req, res) => {
        return req.body.email || req.ip;
    },
    // Completely disable validation warnings to stop the IPv6 startup error
    validate: false,
    handler: (req, res, next, options) => {
        const resetTime = req.rateLimit.resetTime;
        const now = Date.now();
        const msLeft = resetTime - now;
        const minutesLeft = Math.ceil(msLeft / 60000); // Convert ms to minutes

        res.status(options.statusCode).send(`Too many login attempts. You have ${minutesLeft} minutes left.`);
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = loginLimiter;
