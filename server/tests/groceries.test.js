const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const WeeklyPlan = require('../models/WeeklyPlan');
const GroceryList = require('../models/GroceryList');

const A = '111111111111111111111111';
const B = '222222222222222222222222';
const PLAN_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PLAN_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const PLAN_NEXT = 'cccccccccccccccccccccccc';
const WEEK = '2026-10-12';
const NEXT_WEEK = '2026-10-19';
const token = (user = A) => jwt.sign({ user: { id: user } }, process.env.JWT_SECRET, { expiresIn: '1h' });
const copy = value => JSON.parse(JSON.stringify(value));
let lists, plans, indexReady;

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use('/api/grocery', require('../routes/groceryRoutes'));
app.use(require('../middleware/errorHandler'));

const matches = (document, filter) => Object.entries(filter).every(([field, value]) => {
    if (field === '$or') return value.some(option => matches(document, option));
    if (field === 'items._id') return document.items.some(item => String(item._id) === String(value));
    if (value && typeof value === 'object' && '$exists' in value) return (document[field] !== undefined) === value.$exists;
    return String(document[field]) === String(value);
});
const validateDocument = data => {
    const document = new GroceryList(data);
    const error = document.validateSync();
    if (error) throw error;
    return copy(document.toObject());
};
const selected = filter => [...lists.values()].filter(document => matches(document, filter));
const mealPlan = () => [{
    day: 'Monday',
    breakfast: { ingredients: ['1/2 kg carrots', '1 L milk'] },
    lunch: null,
    dinner: null,
    snack: { ingredients: ['250 g carrots', '2 apples'] },
}];

beforeEach(() => {
    lists = new Map();
    indexReady = false;
    plans = new Map([
        [PLAN_A, { _id: PLAN_A, user: A, weekStart: WEEK, revision: 1, plan: mealPlan() }],
        [PLAN_B, { _id: PLAN_B, user: B, weekStart: WEEK, revision: 1, plan: [{ day: 'Monday', snack: { ingredients: ['3 pears'] } }] }],
        [PLAN_NEXT, { _id: PLAN_NEXT, user: A, weekStart: NEXT_WEEK, revision: 1, plan: [] }],
    ]);
    jest.spyOn(User, 'findById').mockImplementation(id => ({ select: async () => [A, B].includes(id) ? { _id: id, isSuspended: false } : null }));
    jest.spyOn(WeeklyPlan, 'findOne').mockImplementation(filter => ({ lean: async () => copy([...plans.values()].find(plan => matches(plan, filter)) || null) }));
    jest.spyOn(GroceryList, 'init').mockImplementation(async () => { indexReady = true; });
    jest.spyOn(GroceryList, 'find').mockImplementation(filter => ({
        sort() { return this; },
        lean: async () => copy(selected(filter).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))),
    }));
    jest.spyOn(GroceryList, 'findOne').mockImplementation(filter => ({ lean: async () => copy(selected(filter)[0] || null) }));
    jest.spyOn(GroceryList, 'create').mockImplementation(async data => {
        if (data.weekStart) expect(indexReady).toBe(true);
        const document = validateDocument(data);
        if (document.weekStart && selected({ user: document.user, weekStart: document.weekStart }).length) {
            throw Object.assign(new Error('Duplicate week'), { code: 11000 });
        }
        lists.set(document._id, document);
        return copy(document);
    });
    jest.spyOn(GroceryList, 'findOneAndUpdate').mockImplementation((filter, update, options) => ({
        lean: async () => {
            expect(options).toMatchObject({ new: true, runValidators: true });
            const current = selected(filter)[0];
            if (!current) return null;
            const next = copy(current);
            for (const [field, value] of Object.entries(update.$set || {})) {
                if (field === 'items.$.checked') next.items.find(item => item._id === filter['items._id']).checked = value;
                else next[field] = value;
            }
            for (const field of Object.keys(update.$unset || {})) delete next[field];
            next.revision = (next.revision || 0) + update.$inc.revision;
            const saved = validateDocument(next);
            lists.set(saved._id, saved);
            return copy(saved);
        },
    }));
    jest.spyOn(GroceryList, 'findOneAndDelete').mockImplementation(filter => ({
        lean: async () => {
            const current = selected(filter)[0];
            if (!current) return null;
            lists.delete(current._id);
            return copy(current);
        },
    }));
});

afterEach(() => jest.restoreAllMocks());

const post = (body, user = A) => request(app).post('/api/grocery').set('x-auth-token', token(user)).send(body);
const generate = (changes = {}, user = A) => post({ sourcePlanId: PLAN_A, sourcePlanRevision: 1, weekStart: WEEK, revision: 0, ...changes }, user);
const get = (weekStart = WEEK, user = A) => request(app).get('/api/grocery').query(weekStart === null ? {} : { weekStart }).set('x-auth-token', token(user));
const update = (listId, body, user = A) => request(app).put(`/api/grocery/${listId}`).set('x-auth-token', token(user)).send(body);
const remove = (listId, revision, user = A) => request(app).delete(`/api/grocery/${listId}`).query({ revision }).set('x-auth-token', token(user));

test('server generates deterministic quantities including snacks and saves stable item identities', async () => {
    const saved = (await generate().expect(201)).body;
    expect(saved).toMatchObject({ weekStart: WEEK, revision: 1, sourcePlan: PLAN_A, sourcePlanRevision: 1 });
    expect(saved.items.map(({ name, amount, checked }) => ({ name, amount, checked }))).toEqual([
        { name: 'apples', amount: 'x2', checked: false },
        { name: 'carrots', amount: '750 g', checked: false },
        { name: 'milk', amount: '1 L', checked: false },
    ]);
    expect(new Set(saved.items.map(item => item._id)).size).toBe(3);
    expect(new Set(saved.items.map(item => item.key)).size).toBe(3);
    expect((await get().expect(200)).body).toEqual([saved]);
    expect(GroceryList.schema.indexes()).toContainEqual([
        { user: 1, weekStart: 1 },
        expect.objectContaining({ unique: true, partialFilterExpression: { weekStart: { $type: 'string' } } }),
    ]);
});

test('checkbox changes address an item ID, survive reload, and never alter a different item', async () => {
    const saved = (await generate().expect(201)).body;
    const target = saved.items.find(item => item.name === 'milk');
    const changed = (await update(saved._id, { itemId: target._id, checked: true, revision: saved.revision }).expect(200)).body;
    expect(changed.revision).toBe(2);
    expect(changed.items.filter(item => item.checked).map(item => item._id)).toEqual([target._id]);
    expect((await get().expect(200)).body[0]).toEqual(changed);
    expect(GroceryList.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ user: A, _id: saved._id, revision: 1, 'items._id': target._id }),
        expect.objectContaining({ $set: expect.objectContaining({ 'items.$.checked': true }), $inc: { revision: 1 } }),
        expect.anything(),
    );
});

test('regeneration preserves checked state only when ingredient identity and amount both match', async () => {
    let saved = (await generate().expect(201)).body;
    const carrots = saved.items.find(item => item.name === 'carrots');
    saved = (await update(saved._id, { itemId: carrots._id, checked: true, revision: 1 }).expect(200)).body;
    const unchanged = (await generate({ revision: saved.revision }).expect(201)).body;
    expect(unchanged._id).toBe(saved._id);
    expect(unchanged.items.find(item => item.name === 'carrots')).toMatchObject({ _id: carrots._id, key: carrots.key, checked: true });
    plans.get(PLAN_A).plan[0].snack.ingredients[0] = '500 g carrots';
    plans.get(PLAN_A).revision = 2;
    const changed = (await generate({ revision: unchanged.revision, sourcePlanRevision: 2 }).expect(201)).body;
    const changedCarrots = changed.items.find(item => item.name === 'carrots');
    expect(changedCarrots).toMatchObject({ key: carrots.key, amount: '1 kg', checked: false });
    expect(changedCarrots._id).not.toBe(carrots._id);
    expect(lists.size).toBe(1);
});

test('lists are isolated by week and account while undated lists remain explicitly separate', async () => {
    const current = (await generate().expect(201)).body;
    const next = (await generate({ sourcePlanId: PLAN_NEXT, weekStart: NEXT_WEEK }).expect(201)).body;
    const other = (await generate({ sourcePlanId: PLAN_B }, B).expect(201)).body;
    const undated = (await post({ items: [{ name: 'Old manual item' }], revision: 0 }).expect(201)).body;
    expect(undated.weekStart).toBeNull();
    expect((await get().expect(200)).body.map(list => list._id)).toEqual([current._id, undated._id]);
    expect((await get(NEXT_WEEK).expect(200)).body.map(list => list._id)).toEqual([next._id, undated._id]);
    expect((await get(WEEK, B).expect(200)).body.map(list => list._id)).toEqual([other._id]);
    expect((await get(null).expect(200)).body.map(list => list._id).sort()).toEqual([current._id, next._id, undated._id].sort());
});

test('another account cannot generate from, check, replace or delete private plans and lists', async () => {
    const saved = (await generate().expect(201)).body;
    await generate({}, B).expect(404);
    await update(saved._id, { itemId: saved.items[0]._id, checked: true, revision: 1 }, B).expect(404);
    await update(saved._id, { items: [], revision: 1 }, B).expect(404);
    await remove(saved._id, 1, B).expect(404);
    expect((await get().expect(200)).body[0]).toEqual(saved);
});

test('wrong-week, unavailable and stale source plans cannot create or replace a grocery list', async () => {
    const saved = (await generate().expect(201)).body;
    await generate({ weekStart: NEXT_WEEK }).expect(404);
    await generate({ sourcePlanId: 'dddddddddddddddddddddddd' }).expect(404);
    await generate({ sourcePlanRevision: 2, revision: saved.revision }).expect(409);
    expect((await get().expect(200)).body[0]).toEqual(saved);
});

test('simultaneous first generations create one dated list and stale changes do not overwrite it', async () => {
    const first = await Promise.all([generate(), generate()]);
    expect(first.map(result => result.status).sort()).toEqual([201, 409]);
    const saved = first.find(result => result.status === 201).body;
    const toggles = await Promise.all([
        update(saved._id, { itemId: saved.items[0]._id, checked: true, revision: 1 }),
        update(saved._id, { itemId: saved.items[1]._id, checked: true, revision: 1 }),
    ]);
    expect(toggles.map(result => result.status).sort()).toEqual([200, 409]);
    expect((await get().expect(200)).body[0].items.filter(item => item.checked)).toHaveLength(1);
    await generate({ revision: 1 }).expect(409);
    await update(saved._id, { items: [], revision: 1 }).expect(409);
    await remove(saved._id, 1).expect(409);
    expect(lists.size).toBe(1);
});

test('regeneration racing a checkbox update uses the same atomic revision guard', async () => {
    const saved = (await generate().expect(201)).body;
    const results = await Promise.all([
        generate({ revision: 1 }),
        update(saved._id, { itemId: saved.items[0]._id, checked: true, revision: 1 }),
    ]);
    expect(results.filter(result => [200, 201].includes(result.status))).toHaveLength(1);
    expect(results.filter(result => result.status === 409)).toHaveLength(1);
    expect((await get().expect(200)).body[0].revision).toBe(2);
});

test('legacy documents without revision or keys can be checked without assigning a week', async () => {
    const legacy = { _id: 'dddddddddddddddddddddddd', user: A, createdAt: '2026-01-01', items: [{ _id: 'eeeeeeeeeeeeeeeeeeeeeeee', name: 'Old carrots', amount: '2', checked: false }] };
    lists.set(legacy._id, copy(legacy));
    const read = (await get().expect(200)).body[0];
    expect(read).toMatchObject({ weekStart: null, revision: 0, sourcePlanRevision: null });
    expect(read.items[0].key).toBe(`legacy:${legacy.items[0]._id}`);
    const changed = (await update(legacy._id, { itemId: legacy.items[0]._id, checked: true, revision: 0 }).expect(200)).body;
    expect(changed).toMatchObject({ weekStart: null, revision: 1 });
    expect(changed.items[0]).toMatchObject({ _id: legacy.items[0]._id, checked: true });
    expect(lists.get(legacy._id)).not.toHaveProperty('weekStart');
    await update(legacy._id, { itemId: legacy.items[0]._id, checked: false, revision: 0 }).expect(409);
});

test('manual creation/replacement and generated custom additions remain supported safely', async () => {
    const manual = (await post({ items: [{ name: 'Paper towels', amount: '2 rolls', checked: true }], revision: 0 }).expect(201)).body;
    expect(manual.items[0]).toMatchObject({ name: 'Paper towels', amount: '2 rolls', checked: true });
    const replaced = (await update(manual._id, { items: [{ ...manual.items[0], amount: '3 rolls' }], revision: 1 }).expect(200)).body;
    expect(replaced.items[0]).toMatchObject({ _id: manual.items[0]._id, amount: '3 rolls' });
    const generated = (await generate({ items: [{ name: 'Paper towels', amount: '2 rolls' }] }).expect(201)).body;
    expect(generated.items).toHaveLength(4);
    expect(generated.items.some(item => item.name === 'carrots')).toBe(true);
    expect(generated.items.some(item => item.name === 'Paper towels')).toBe(true);
    await remove(manual._id, replaced.revision).expect(200);
    expect(lists.has(manual._id)).toBe(false);
});

test('target item IDs must belong to the selected list', async () => {
    const saved = (await generate().expect(201)).body;
    const other = (await post({ items: [{ name: 'Different list item' }], revision: 0 }).expect(201)).body;
    await update(saved._id, { itemId: other.items[0]._id, checked: true, revision: 1 }).expect(404);
    expect((await get().expect(200)).body.find(list => list._id === saved._id)).toEqual(saved);
});

test.each([
    { items: [{ name: '   ' }], revision: 0 },
    { items: [{ name: 'Carrots', checked: 'false' }], revision: 0 },
    { items: [{ name: 'Carrots', _id: { $ne: null } }], revision: 0 },
    { items: [{ name: 'Carrots', amount: 2 }], revision: 0 },
    { items: [{ name: 'Carrots', key: { $ne: null } }], revision: 0 },
    { items: [{ name: 'Carrots' }, { name: ' carrots ' }], revision: 0 },
    { items: [{ name: 'Carrots', _id: PLAN_A }, { name: 'Milk', _id: PLAN_A }], revision: 0 },
    { items: [], revision: '0' },
    { items: [], revision: -1 },
    { items: [], revision: 0, weekStart: '2026-10-13' },
    { items: [], revision: 0, user: B },
    { revision: 0 },
])('rejects invalid or ambiguous manual item payload %#', async body => {
    await post(body).expect(400);
    expect(lists.size).toBe(0);
});

test.each([
    { sourcePlanRevision: 0 },
    { sourcePlanRevision: '1' },
    { sourcePlanId: 'invalid' },
    { weekStart: undefined },
    { revision: undefined },
])('rejects incomplete generation identity %#', async changes => {
    await generate(changes).expect(400);
    expect(lists.size).toBe(0);
});

test('invalid targeted updates and missing delete revisions cannot mutate lists', async () => {
    const saved = (await generate().expect(201)).body;
    for (const body of [
        { itemId: 0, checked: true, revision: 1 },
        { itemId: saved.items[0]._id, checked: 'true', revision: 1 },
        { itemId: saved.items[0]._id, checked: true, items: [], revision: 1 },
        { itemId: saved.items[0]._id, checked: true },
    ]) await update(saved._id, body).expect(400);
    await request(app).delete(`/api/grocery/${saved._id}`).set('x-auth-token', token()).expect(400);
    expect((await get().expect(200)).body[0]).toEqual(saved);
});

test('invalid week queries and logged-out operations fail before reading private data', async () => {
    await get('2026-10-13').expect(400);
    await request(app).get('/api/grocery').expect(401);
    await request(app).post('/api/grocery').send({ items: [], revision: 0 }).expect(401);
    await request(app).put(`/api/grocery/${PLAN_A}`).send({ items: [], revision: 0 }).expect(401);
    await request(app).delete(`/api/grocery/${PLAN_A}`).query({ revision: 0 }).expect(401);
    expect(GroceryList.find).not.toHaveBeenCalled();
    expect(GroceryList.create).not.toHaveBeenCalled();
});
