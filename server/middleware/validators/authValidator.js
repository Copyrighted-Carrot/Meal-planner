const { body } = require('express-validator');

const registerValidator = [
    body('name', 'Name is required').not().isEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
];

const loginValidator = [
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password is required').exists()
];

module.exports = { registerValidator, loginValidator };
