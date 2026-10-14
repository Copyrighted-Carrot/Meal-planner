const planService = require("../services/planService");
const asyncHandler = require("../utils/asyncHandler");

const getPlan = asyncHandler(async (req, res) => {
    const plan = await planService.getPlan(req.user.id);
    res.json(plan);
});

const savePlan = asyncHandler(async (req, res) => {
    const { plan } = req.body;
    const result = await planService.savePlan(req.user.id, plan);
    res.json(result);
});

module.exports = {
    getPlan,
    savePlan,
};
