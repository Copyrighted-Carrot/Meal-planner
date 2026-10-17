const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Meal = require('../models/Meal');
const WeeklyPlan = require('../models/WeeklyPlan');
const { isWeekStart } = require('../utils/planDate');

const A = '111111111111111111111111';
const B = '222222222222222222222222';
const OWN = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const PUBLIC = 'cccccccccccccccccccccccc';
const WEEK = '2026-10-12';
const NEXT_WEEK = '2026-10-19';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const token = (user = A) => jwt.sign({ user: { id: user } }, process.env.JWT_SECRET, { expiresIn: '1h' });
const plan = (meal = OWN) => DAYS.map(day => ({ day, breakfast: meal, lunch: null, dinner: PUBLIC, snack: meal }));
const copy = value => JSON.parse(JSON.stringify(value));
const key = (user, weekStart) => `${user}:${weekStart || 'undated'}`;
let documents, indexReady, meals;

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use('/api/plan', require('../routes/planRoutes'));
app.use(require('../middleware/errorHandler'));

// Model persistence is isolated from real accounts/databases. Actual Mongoose
// schemas still cast and validate every saved document before storage.
const validateDocument = data => {
    const document = new WeeklyPlan(data);
    const error = document.validateSync();
    if (error) throw error;
    return copy(document.toObject());
};
const matches = (document, filter) => Object.entries(filter).every(([field, value]) => {
    if (value && typeof value === 'object' && '$exists' in value) return (document[field] !== undefined) === value.$exists;
    return String(document[field]) === String(value);
});

beforeEach(() => {
    documents = new Map();
    indexReady = false;
    meals = [
        { _id: OWN, user: A, name: 'Carrot snack', ingredients: ['1/2 cup carrots'], imageUrl: 'unused-image', nutrition: { calories: 900 } },
        { _id: OTHER, user: B, name: 'Private B meal', ingredients: ['2 apples'] },
        { _id: PUBLIC, isGlobal: true, name: 'Public soup', ingredients: ['250 ml stock'] },
    ];
    jest.spyOn(User, 'findById').mockImplementation(id => ({ select: async () => [A, B].includes(id) ? { _id: id, isSuspended: false } : null }));
    jest.spyOn(Meal, 'find').mockImplementation(filter => ({
        select() { return this; },
        lean: async () => meals.filter(meal => filter._id.$in.includes(meal._id)
            && filter.$or.some(allowed => Object.entries(allowed).every(([field, value]) => meal[field] === value))),
    }));
    jest.spyOn(WeeklyPlan, 'init').mockImplementation(async () => { indexReady = true; });
    jest.spyOn(WeeklyPlan, 'findOne').mockImplementation(filter => ({
        sort() { return this; },
        lean: async () => copy([...documents.values()].find(document => matches(document, filter)) || null),
    }));
    jest.spyOn(WeeklyPlan, 'create').mockImplementation(async data => {
        expect(indexReady).toBe(true);
        const document = validateDocument(data);
        const documentKey = key(document.user, document.weekStart);
        if (documents.has(documentKey)) throw Object.assign(new Error('Duplicate week'), { code: 11000 });
        documents.set(documentKey, document);
        return copy(document);
    });
    jest.spyOn(WeeklyPlan, 'findOneAndUpdate').mockImplementation((filter, update, options) => ({
        lean: async () => {
            expect(options).toMatchObject({ new: true, runValidators: true });
            const document = documents.get(key(filter.user, filter.weekStart));
            if (!document || !matches(document, filter)) return null;
            const updated = validateDocument({ ...document, ...update.$set, revision: document.revision + update.$inc.revision });
            documents.set(key(filter.user, filter.weekStart), updated);
            return copy(updated);
        },
    }));
});

afterEach(() => jest.restoreAllMocks());

const save = (body, user = A) => request(app).post('/api/plan').set('x-auth-token', token(user)).send(body);
const load = (weekStart = WEEK, user = A) => request(app).get('/api/plan').query({ weekStart }).set('x-auth-token', token(user));

test('actual schema preserves all four slots and snapshots without image/nutrition payloads', () => {
    const snapshot = { _id: OWN, name: 'Carrot snack', ingredients: ['1/2 cup carrots'], imageUrl: 'not-stored', nutrition: { calories: 900 } };
    const document = validateDocument({ user: A, weekStart: WEEK, revision: 1, plan: [{ day: 'Monday', ...Object.fromEntries(SLOTS.map(slot => [slot, snapshot])) }] });
    for (const slot of SLOTS) expect(document.plan[0][slot]).toEqual({ _id: OWN, name: 'Carrot snack', ingredients: ['1/2 cup carrots'] });
    expect(WeeklyPlan.schema.indexes()).toContainEqual([
        { user: 1, weekStart: 1 },
        expect.objectContaining({ unique: true, partialFilterExpression: { weekStart: { $type: 'string' } } }),
    ]);
});

test('seven days including snacks survive save, persistence, fetch and a later update', async () => {
    const saved = await save({ weekStart: WEEK, revision: 0, plan: plan() }).expect(200);
    expect(saved.body).toMatchObject({ weekStart: WEEK, revision: 1, legacyPlan: null });
    expect(mongoose.isValidObjectId(saved.body._id)).toBe(true);
    expect(saved.body.plan).toHaveLength(7);
    for (const day of saved.body.plan) {
        expect(day.snack).toEqual({ _id: OWN, name: 'Carrot snack', ingredients: ['1/2 cup carrots'] });
        expect(day.dinner._id).toBe(PUBLIC);
        expect(day.lunch).toBeNull();
    }
    expect((await load().expect(200)).body).toEqual(saved.body);
    const changed = plan();
    changed[0].snack = null;
    const update = await save({ weekStart: WEEK, revision: 1, plan: changed }).expect(200);
    expect(update.body.revision).toBe(2);
    expect((await load().expect(200)).body).toEqual(update.body);
    expect(update.body.plan[0].snack).toBeNull();
    expect(update.body.plan[1].snack._id).toBe(OWN);
});

test('week and authenticated user identify separate plans, never the latest arbitrary plan', async () => {
    await save({ weekStart: WEEK, revision: 0, plan: plan() }).expect(200);
    expect((await load(NEXT_WEEK).expect(200)).body).toEqual({ _id: null, weekStart: NEXT_WEEK, revision: 0, plan: [], legacyPlan: null });
    await save({ weekStart: NEXT_WEEK, revision: 0, plan: [] }).expect(200);
    await save({ weekStart: WEEK, revision: 0, plan: plan(OTHER) }, B).expect(200);
    expect((await load().expect(200)).body.plan[0].snack._id).toBe(OWN);
    expect((await load(WEEK, B).expect(200)).body.plan[0].snack._id).toBe(OTHER);
    expect((await load(NEXT_WEEK).expect(200)).body.plan).toEqual([]);
    expect(documents.size).toBe(3);
});

test('saved snapshots survive later meal deletion and cannot be overwritten by a failed save', async () => {
    const saved = (await save({ weekStart: WEEK, revision: 0, plan: plan().reverse() }).expect(200)).body;
    expect(saved.plan.map(day => day.day)).toEqual(DAYS);
    meals = meals.filter(meal => meal._id !== OWN);
    expect((await load().expect(200)).body).toEqual(saved);
    await save({ weekStart: WEEK, revision: 1, plan: plan() }).expect(400);
    expect((await load().expect(200)).body).toEqual(saved);
});

test('stale revisions and simultaneous first saves cannot overwrite newer data', async () => {
    const first = await Promise.all([
        save({ weekStart: WEEK, revision: 0, plan: plan() }),
        save({ weekStart: WEEK, revision: 0, plan: [] }),
    ]);
    expect(first.map(result => result.status).sort()).toEqual([200, 409]);
    expect(documents.size).toBe(1);
    const updates = await Promise.all([
        save({ weekStart: WEEK, revision: 1, plan: [] }),
        save({ weekStart: WEEK, revision: 1, plan: plan() }),
    ]);
    expect(updates.map(result => result.status).sort()).toEqual([200, 409]);
    const current = (await load().expect(200)).body;
    expect(current.revision).toBe(2);
    await save({ weekStart: WEEK, revision: 1, plan: plan() }).expect(409);
    expect((await load().expect(200)).body).toEqual(current);
    expect(WeeklyPlan.init).toHaveBeenCalled();
});

test('an undated plan is offered explicitly without silently assigning or modifying it', async () => {
    const legacy = { _id: 'dddddddddddddddddddddddd', user: A, createdAt: '2026-01-01', plan: [{ day: 'Monday', breakfast: meals[0], snack: null }] };
    documents.set(key(A), copy(legacy));
    const read = (await load().expect(200)).body;
    expect(read).toMatchObject({ _id: null, revision: 0, plan: [] });
    expect(read.legacyPlan[0].breakfast._id).toBe(OWN);
    expect((await load(WEEK, B).expect(200)).body.legacyPlan).toBeNull();
    expect(documents.get(key(A))).toEqual(legacy);
    await save({ weekStart: WEEK, revision: 0, plan: plan() }).expect(200);
    expect((await load().expect(200)).body.legacyPlan).toBeNull();
    expect(documents.get(key(A))).toEqual(legacy);
});

test.each([undefined, '', '2026-10-13', '2026-02-30', '2026-10-12T00:00:00Z', '12-10-2026'])('rejects missing or ambiguous week identity: %s', async weekStart => {
    await load(weekStart === undefined ? '' : weekStart).expect(400);
    await save({ weekStart, revision: 0, plan: plan() }).expect(400);
    expect(WeeklyPlan.create).not.toHaveBeenCalled();
});

test('Monday validation handles calendar boundaries without local time-zone conversion', () => {
    expect(isWeekStart('2024-12-30')).toBe(true);
    expect(isWeekStart('2024-02-26')).toBe(true);
    expect(isWeekStart('2024-02-30')).toBe(false);
    expect(isWeekStart(['2026-10-12'])).toBe(false);
});

test.each([
    ['a missing day', () => plan().slice(0, 6)],
    ['duplicate weekdays', () => plan().map(day => ({ ...day, day: 'Monday' }))],
    ['missing snack slot', () => plan().map(({ snack, ...day }) => day)],
    ['full meal payloads', () => plan().map(day => ({ ...day, snack: { _id: OWN, imageUrl: 'large-image' } }))],
    ['extra day fields', () => plan().map(day => ({ ...day, image: 'large-image' }))],
    ['invalid meal IDs', () => plan().map(day => ({ ...day, snack: 'not-an-id' }))],
])('rejects %s without changing stored data', async (name, invalidPlan) => {
    await save({ weekStart: WEEK, revision: 0, plan: invalidPlan() }).expect(400);
    expect(documents.size).toBe(0);
});

test.each([-1, 1.5, '0', null, Number.MAX_SAFE_INTEGER])('rejects invalid revision %s', async revision => {
    await save({ weekStart: WEEK, revision, plan: plan() }).expect(400);
    expect(documents.size).toBe(0);
});

test('unavailable/deleted and another account private meal IDs are rejected identically', async () => {
    const privateMeal = await save({ weekStart: WEEK, revision: 0, plan: plan(OTHER) }).expect(400);
    const deletedMeal = await save({ weekStart: WEEK, revision: 0, plan: plan('eeeeeeeeeeeeeeeeeeeeeeee') }).expect(400);
    expect(privateMeal.body).toEqual(deletedMeal.body);
    expect(documents.size).toBe(0);
    expect(Meal.find).toHaveBeenCalledWith(expect.objectContaining({ $or: [{ user: A }, { isGlobal: true }] }));
});

test('logged-out plan reads and writes are rejected before querying data', async () => {
    await request(app).get('/api/plan').query({ weekStart: WEEK }).expect(401);
    await request(app).post('/api/plan').send({ weekStart: WEEK, revision: 0, plan: plan() }).expect(401);
    expect(WeeklyPlan.findOne).not.toHaveBeenCalled();
    expect(WeeklyPlan.create).not.toHaveBeenCalled();
});
