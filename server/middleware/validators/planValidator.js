const { body, query } = require('express-validator');
const { isWeekStart } = require('../../utils/planDate');

const weekValidator = [query('weekStart').custom(isWeekStart).withMessage('Week must be a valid Monday date (YYYY-MM-DD)')];

const planValidator = [
    body('weekStart').custom(isWeekStart).withMessage('Week must be a valid Monday date (YYYY-MM-DD)'),
    body('revision').custom(value => Number.isSafeInteger(value) && value >= 0).withMessage('Revision must be a non-negative integer'),
    body('plan', 'Plan must be an array with at most seven days').isArray({ max: 7 }),
];

module.exports = { planValidator, weekValidator };
