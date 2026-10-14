const express = require('express');
const router = express.Router();
const { parseIngredientsWithAI } = require('../utils/aiService');
const auth = require('../middleware/auth'); // Optional: Protect this route if needed

router.post('/parse', auth, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ msg: "No text provided" });

        const ingredients = await parseIngredientsWithAI(text);
        res.json(ingredients);
    } catch (error) {
        console.error("Route Error:", error);
        res.status(500).json({ msg: error.message, stack: error.stack });
    }
});

module.exports = router;
