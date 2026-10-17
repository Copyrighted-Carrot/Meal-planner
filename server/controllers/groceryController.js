const groceryService = require("../services/groceryService");
const asyncHandler = require("../utils/asyncHandler");

const getLists = asyncHandler(async (req, res) => {
    const lists = await groceryService.getLists(req.user.id, req.query.weekStart);
    res.json(lists);
});

const createList = asyncHandler(async (req, res) => {
    const list = await groceryService.createList(req.user.id, req.body);
    res.status(201).json(list);
});

const updateList = asyncHandler(async (req, res) => {
    const list = await groceryService.updateList(req.user.id, req.params.id, req.body);
    res.json(list);
});

const deleteList = asyncHandler(async (req, res) => {
    const result = await groceryService.deleteList(req.user.id, req.params.id, Number(req.query.revision));
    res.json(result);
});

module.exports = {
    getLists,
    createList,
    updateList,
    deleteList
};
