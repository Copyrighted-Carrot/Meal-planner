const { body } = require('express-validator');

const createMealValidator = [
    body('name', 'Name is required').not().isEmpty(),
    body('category', 'Category is required').not().isEmpty(),
    body('ingredients', 'Ingredients are required').exists(),
    body('cropX').optional(),
    body('cropY').optional(),
    body('cropWidth').optional(),
    body('cropHeight').optional()
];

module.exports = { createMealValidator };
