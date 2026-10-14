const { param } = require('express-validator');

const validateObjectId = (field) => {
    return param(field).isMongoId().withMessage(`Invalid ${field}`);
};

module.exports = { validateObjectId };
