const planService = require("../services/planService");
const asyncHandler = require("../utils/asyncHandler");

const getPlan = asyncHandler(async (req, res) => {
    const plan = await planService.getPlan(req.user.id, req.query.weekStart);
    res.json(plan);
});

const savePlan = asyncHandler(async (req, res) => {
    const result = await planService.savePlan(req.user.id, req.body);
    res.json(result);
});

module.exports = {
    getPlan,
    savePlan,
};
