const { body } = require('express-validator');

const planValidator = [
    body('plan', 'Plan must be an array').isArray()
];

module.exports = { planValidator };
