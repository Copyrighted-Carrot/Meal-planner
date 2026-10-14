const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Extract error messages
        const errorMessages = errors.array().map(err => `${err.path}: ${err.msg}`).join(', ');
        return next(new AppError(`Validation Error: ${errorMessages}`, 400));
    }
    next();
};

module.exports = validate;
