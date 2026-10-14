const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

const securityMiddleware = (app) => {
    // Data Sanitization against NoSQL query injection
    app.use(mongoSanitize());

    // Data Sanitization against XSS
    app.use(xss());
};

module.exports = securityMiddleware;
