const express = require("express");
const router = express.Router();
const groceryController = require("../controllers/groceryController");
const requireAuth = require("../middleware/requireAuth");
const validate = require("../middleware/validate");
const { validateObjectId } = require("../middleware/validators/commonValidator");
const { body } = require('express-validator');

// Basic validator for creating/updating lists (could be moved to separate file)
const listValidator = [
    body('items').optional().isArray().withMessage('Items must be an array'),
];

router.get("/", requireAuth, groceryController.getLists);

router.post(
    "/",
    requireAuth,
    listValidator,
    validate,
    groceryController.createList
);

router.put(
    "/:id",
    requireAuth,
    validateObjectId('id'),
    listValidator,
    validate,
    groceryController.updateList
);

router.delete(
    "/:id",
    requireAuth,
    validateObjectId('id'),
    validate,
    groceryController.deleteList
);

module.exports = router;
