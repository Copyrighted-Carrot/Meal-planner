const crypto = require('node:crypto');
const GroceryList = require('../models/GroceryList');
const WeeklyPlan = require('../models/WeeklyPlan');
const AppError = require('../utils/AppError');
const { isWeekStart } = require('../utils/planDate');
const { aggregatePlanIngredients } = require('../utils/groceryAggregation');

const conflict = () => new AppError('This grocery list changed since you loaded it. Reload the list before changing it again.', 409);
const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const revisionOf = document => document.revision || 0;
const requireRevision = revision => {
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) {
        throw new AppError('revision must be a non-negative integer', 400);
    }
};
const requireWeek = weekStart => {
    if (!isWeekStart(weekStart)) throw new AppError('weekStart must be a valid Monday date (YYYY-MM-DD)', 400);
};
const requireFields = (data, fields) => {
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => !fields.includes(key))) {
        throw new AppError('Unsupported grocery request fields', 400);
    }
};
const itemKey = item => item.key || `legacy:${item._id}`;
const envelope = list => ({
    _id: list._id,
    weekStart: list.weekStart || null,
    revision: revisionOf(list),
    sourcePlan: list.sourcePlan || null,
    sourcePlanRevision: list.sourcePlanRevision || null,
    items: list.items.map(item => ({
        _id: item._id, key: itemKey(item), name: item.name, amount: item.amount || '', checked: item.checked === true,
    })),
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
});

// A missing revision belongs only to an old undated list. The atomic update
// upgrades it to revision 1 without assigning a week or replacing its contents.
const revisionFilter = (userId, listId, revision) => ({
    _id: listId,
    user: userId,
    ...(revision === 0 ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision }),
});

const getLists = async (userId, weekStart) => {
    if (weekStart !== undefined) requireWeek(weekStart);
    const filter = { user: userId };
    if (weekStart !== undefined) filter.$or = [{ weekStart }, { weekStart: { $exists: false } }];
    const lists = await GroceryList.find(filter).sort({ createdAt: -1, _id: -1 }).lean();
    // The selected week's list is first; older undated lists remain available.
    if (weekStart !== undefined) lists.sort((a, b) => Number(b.weekStart === weekStart) - Number(a.weekStart === weekStart));
    return lists.map(envelope);
};

const validateItems = (items, existingItems = []) => {
    if (!Array.isArray(items) || items.length > 500) throw new AppError('items must be an array with at most 500 entries', 400);
    const byKey = new Map(existingItems.map(item => [itemKey(item), item]));
    const keys = new Set();
    const ids = new Set();
    return items.map(item => {
        requireFields(item, ['_id', 'key', 'name', 'amount', 'checked']);
        if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 1000
            || (item.amount !== undefined && (typeof item.amount !== 'string' || item.amount.length > 1000))
            || (item.checked !== undefined && typeof item.checked !== 'boolean')
            || (item._id !== undefined && !validId(item._id))
            || (item.key !== undefined && (typeof item.key !== 'string' || !/^[a-z\d:_-]{1,160}$/i.test(item.key)))) {
            throw new AppError('Each grocery item needs a valid name, amount, checked state and identity', 400);
        }
        const name = item.name.trim();
        const amount = (item.amount || '').trim();
        const key = item.key || `manual:${crypto.createHash('sha256').update(name.toLowerCase().replace(/\s+/g, ' ')).digest('hex')}`;
        const previous = byKey.get(key);
        const id = item._id?.toLowerCase() || (previous && previous.amount === amount ? String(previous._id) : undefined);
        if (keys.has(key) || (id && ids.has(String(id)))) throw new AppError('Grocery items must have unique keys and IDs', 400);
        keys.add(key);
        if (id) ids.add(String(id));
        return {
            ...(id ? { _id: id } : {}), key, name, amount,
            checked: item.checked !== undefined ? item.checked : Boolean(previous && previous.amount === amount && previous.checked),
        };
    });
};

const createList = async (userId, data) => {
    requireFields(data, ['sourcePlanId', 'sourcePlanRevision', 'weekStart', 'revision', 'items']);
    const { sourcePlanId, sourcePlanRevision, weekStart, revision } = data;
    requireRevision(revision);
    if (weekStart !== undefined) requireWeek(weekStart);
    const fromPlan = sourcePlanId !== undefined && sourcePlanId !== null;
    let sourcePlan;
    if (fromPlan) {
        if (!validId(sourcePlanId)) throw new AppError('sourcePlanId must be a valid plan ID', 400);
        requireWeek(weekStart);
        if (!Number.isSafeInteger(sourcePlanRevision) || sourcePlanRevision < 1) throw new AppError('sourcePlanRevision must be a positive integer', 400);
        sourcePlan = await WeeklyPlan.findOne({ _id: sourcePlanId, user: userId, weekStart }).lean();
        if (!sourcePlan) throw new AppError('Source plan not found', 404);
        if (sourcePlan.revision !== sourcePlanRevision) throw new AppError('The meal plan changed. Reload it before generating groceries.', 409);
    } else if (sourcePlanRevision !== undefined || data.items === undefined) {
        throw new AppError('Provide manual items or a saved source plan', 400);
    }

    const existing = weekStart === undefined ? null : await GroceryList.findOne({ user: userId, weekStart }).lean();
    if ((existing && revisionOf(existing) !== revision) || (!existing && revision !== 0)) throw conflict();
    const oldItems = existing?.items || [];
    const previous = new Map(oldItems.map(item => [itemKey(item), item]));
    const generated = sourcePlan ? aggregatePlanIngredients(sourcePlan.plan).map(item => {
        const old = previous.get(item.key);
        const same = old && old.amount === item.amount;
        return { ...item, ...(same ? { _id: String(old._id) } : {}), checked: Boolean(same && old.checked) };
    }) : [];
    const manual = data.items === undefined ? [] : validateItems(data.items, oldItems);
    // Validate the combined list too, so custom additions cannot duplicate a
    // generated item's key/ID or create an ambiguous checkbox target.
    const items = validateItems([...generated, ...manual], oldItems);
    const values = {
        items,
        sourcePlan: sourcePlan?._id || null,
        ...(sourcePlan ? { sourcePlanRevision } : {}),
        updatedAt: new Date(),
    };
    let saved;
    if (!existing) {
        if (weekStart !== undefined) await GroceryList.init();
        try {
            saved = await GroceryList.create({ user: userId, ...(weekStart !== undefined ? { weekStart } : {}), ...values, revision: 1 });
        } catch (error) {
            if (error.code === 11000) throw conflict();
            throw error;
        }
    } else {
        saved = await GroceryList.findOneAndUpdate(
            revisionFilter(userId, existing._id, revision),
            { $set: values, $inc: { revision: 1 }, ...(!sourcePlan ? { $unset: { sourcePlanRevision: 1 } } : {}) },
            { new: true, runValidators: true },
        ).lean();
        if (!saved) throw conflict();
    }
    return envelope(saved);
};

const findOwnedList = async (userId, listId) => {
    const list = await GroceryList.findOne({ _id: listId, user: userId }).lean();
    if (!list) throw new AppError('Grocery list not found', 404);
    return list;
};

const updateList = async (userId, listId, data) => {
    requireFields(data, ['revision', 'itemId', 'checked', 'items']);
    requireRevision(data.revision);
    const targeted = data.itemId !== undefined;
    if (targeted ? (!validId(data.itemId) || typeof data.checked !== 'boolean' || data.items !== undefined)
        : (data.items === undefined || data.checked !== undefined)) throw new AppError('Provide one item ID and checked state, or a complete manual items array', 400);
    const list = await findOwnedList(userId, listId);
    if (revisionOf(list) !== data.revision) throw conflict();
    const filter = revisionFilter(userId, listId, data.revision);
    let values;
    if (targeted) {
        const itemId = data.itemId.toLowerCase();
        if (!list.items.some(item => String(item._id) === itemId)) throw new AppError('Grocery item not found', 404);
        filter['items._id'] = itemId;
        values = { 'items.$.checked': data.checked, updatedAt: new Date() };
    } else {
        values = { items: validateItems(data.items, list.items), updatedAt: new Date() };
    }
    const saved = await GroceryList.findOneAndUpdate(filter, { $set: values, $inc: { revision: 1 } }, { new: true, runValidators: true }).lean();
    if (!saved) throw conflict();
    return envelope(saved);
};

const deleteList = async (userId, listId, revision) => {
    requireRevision(revision);
    const list = await findOwnedList(userId, listId);
    if (revisionOf(list) !== revision) throw conflict();
    const deleted = await GroceryList.findOneAndDelete(revisionFilter(userId, listId, revision)).lean();
    if (!deleted) throw conflict();
    return { message: 'Grocery List deleted' };
};

module.exports = { getLists, createList, updateList, deleteList };
