const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Meal = require('../models/Meal');
const WeeklyPlan = require('../models/WeeklyPlan');
const GroceryList = require('../models/GroceryList');

jest.mock('../models/User');
jest.mock('../models/Meal');
jest.mock('../models/WeeklyPlan');
jest.mock('../models/GroceryList');
jest.mock('../utils/nutritionCalculator', () => jest.fn(async () => ({ calories: 100 })));
jest.mock('../utils/usageLogger', () => jest.fn());
jest.mock('../utils/aiService', () => ({ parseIngredientsWithAI: jest.fn(async () => []) }));
jest.mock('../config/cloudinary', () => ({ upload: { single: () => (req, res, next) => { mockUploads++; next(); } } }));
jest.mock('../middleware/loginLimiter', () => Object.assign((req, res, next) => { req.rateLimit = { remaining: 9 }; next(); }, { resetKey: jest.fn() }));
jest.mock('google-auth-library', () => ({ OAuth2Client: jest.fn(() => ({ verifyIdToken: (...args) => mockVerifyGoogle(...args) })) }));

const mockVerifyGoogle = jest.fn();
let mockUploads = 0;
const A = '111111111111111111111111';
const B = '222222222222222222222222';
const PRIVATE = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PUBLIC = 'bbbbbbbbbbbbbbbbbbbbbbbb';
let users, meals, password;
const token = (id = A, options = {}) => jwt.sign({ user: { id } }, process.env.JWT_SECRET, { expiresIn: '1h', ...options });
const app = express();
app.use(express.json());
app.use('/api/auth', require('../routes/authRoutes'));
app.use('/api/meals', require('../routes/mealRoutes'));
app.use('/api/plan', require('../routes/planRoutes'));
app.use('/api/grocery', require('../routes/groceryRoutes'));
app.use('/api/ai', require('../routes/aiRoutes'));
app.use(require('../middleware/errorHandler'));

function document(data) {
    const doc = { ...data };
    doc.save = jest.fn(async () => { meals.set(doc._id, doc); return doc; });
    doc.deleteOne = jest.fn(async () => meals.delete(doc._id));
    doc.toObject = () => ({ ...data });
    return doc;
}
beforeEach(async () => {
    jest.clearAllMocks();
    mockUploads = 0;
    password = crypto.randomBytes(20).toString('hex');
    const hash = await bcrypt.hash(password, 4);
    users = new Map([A, B].map(id => [id, { id, _id: id, name: id === A ? 'Account A' : 'Account B', email: `${id}@example.invalid`, password: hash, isSuspended: false, adminNotes: 'private internal note', save: jest.fn(async () => {}) }]));
    meals = new Map([
        [PRIVATE, document({ _id: PRIVATE, user: A, name: 'Private A soup', ingredients: ['carrot'], category: 'Lunch', isGlobal: false, nutrition: { calories: 100 } })],
        [PUBLIC, document({ _id: PUBLIC, name: 'Public soup', ingredients: ['carrot'], category: 'Lunch', isGlobal: true, nutrition: { calories: 100 } })]
    ]);
    User.findById.mockImplementation(id => ({ select: async () => users.get(id) || null }));
    User.findOne.mockImplementation(async ({ email }) => [...users.values()].find(user => user.email === email) || null);
    Meal.findById.mockImplementation(async id => meals.get(id) || null);
    Meal.find.mockImplementation(filter => {
        const selected = [...meals.values()].filter(meal => Object.entries(filter).every(([key, value]) => meal[key] === value));
        return Object.assign(Promise.resolve(selected), { sort: async () => selected });
    });
    Meal.mockImplementation(data => document({ _id: crypto.randomBytes(12).toString('hex'), ...data }));
    Meal.insertMany.mockImplementation(async entries => entries.forEach(data => { const doc = document({ _id: crypto.randomBytes(12).toString('hex'), ...data }); meals.set(doc._id, doc); }));
    WeeklyPlan.findOne.mockResolvedValue(null);
    GroceryList.find.mockReturnValue({ sort: async () => [] });
});

test('A can list/read/update/delete its own meal, and B lists no A meals', async () => {
    const own = await request(app).get('/api/meals').set('x-auth-token', token(A)).expect(200);
    expect(own.body.map(meal => meal._id)).toEqual([PRIVATE]);
    expect((await request(app).get('/api/meals').set('x-auth-token', token(B)).expect(200)).body).toEqual([]);
    await request(app).get(`/api/meals/${PRIVATE}`).set('x-auth-token', token(A)).expect(200);
    const updated = await request(app).put(`/api/meals/${PRIVATE}`).set('x-auth-token', token(A)).send({ name: 'Edited soup', category: 'Lunch', ingredients: ['carrot'] }).expect(200);
    expect(updated.body.name).toBe('Edited soup');
    await request(app).delete(`/api/meals/${PRIVATE}`).set('x-auth-token', token(A)).expect(200);
    expect(meals.has(PRIVATE)).toBe(false);
});

test.each(['get', 'put', 'delete'])('B cannot %s A private meal; unauthorized updates never upload', async method => {
    const result = await request(app)[method](`/api/meals/${PRIVATE}`).set('x-auth-token', token(B)).send({ name: 'Attempt', category: 'Lunch', ingredients: ['carrot'] }).expect(404);
    expect(result.body).not.toHaveProperty('name');
    expect(meals.get(PRIVATE).name).toBe('Private A soup');
    expect(mockUploads).toBe(0);
});

test('B cannot copy a private meal by ID; public recipe copying remains allowed and owned by B', async () => {
    await request(app).post(`/api/meals/copy/${PRIVATE}`).set('x-auth-token', token(B)).expect(404);
    expect(Meal).not.toHaveBeenCalled();
    const copied = await request(app).post(`/api/meals/copy/${PUBLIC}`).set('x-auth-token', token(B)).expect(201);
    expect(copied.body).toMatchObject({ user: B, isGlobal: false, name: 'Public soup' });
});

test.each(['/api/meals', '/api/plan', '/api/grocery', '/api/auth/user', '/api/meals/test-nutrition'])('logged-out %s requests are rejected', async url => {
    await request(app).get(url).expect(401);
});

test.each(['invalid', 'expired', 'deleted', 'malformed'])('%s session cannot access protected resources', async kind => {
    let credential;
    if (kind === 'invalid') credential = 'not-a-signed-token';
    if (kind === 'expired') credential = token(A, { expiresIn: -1 });
    if (kind === 'deleted') { credential = token(); users.delete(A); }
    if (kind === 'malformed') credential = token('not-an-id');
    await request(app).get('/api/meals').set('x-auth-token', credential).expect(401);
    expect(Meal.find).not.toHaveBeenCalled();
});

test('suspending an account revokes access for its already-issued token across every protected area', async () => {
    const issued = token();
    await request(app).get('/api/meals').set('x-auth-token', issued).expect(200);
    users.get(A).isSuspended = true;
    for (const url of ['/api/meals', '/api/plan', '/api/grocery', '/api/auth/user', '/api/meals/test-nutrition']) await request(app).get(url).set('x-auth-token', issued).expect(401);
    for (const url of ['/api/ai/parse', '/api/meals/suggest', '/api/meals/import-starter-pack', `/api/meals/copy/${PUBLIC}`]) await request(app).post(url).set('x-auth-token', issued).send({ text: 'carrot', ingredients: 'carrot' }).expect(401);
});

test('wrong password and nonexistent user produce identical 401 errors even with rate-limit metadata', async () => {
    const missing = await request(app).post('/api/auth/login').send({ email: 'missing@example.invalid', password }).expect(401);
    const wrong = await request(app).post('/api/auth/login').send({ email: users.get(A).email, password: crypto.randomBytes(20).toString('hex') }).expect(401);
    expect(missing.body).toEqual({ message: 'Invalid Credentials' });
    expect(wrong.body).toEqual(missing.body);
});

test('valid login succeeds, suspended password login is rejected, and user responses omit manager fields', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: users.get(A).email, password }).expect(200);
    expect(login.body.token).toBeTruthy();
    const current = await request(app).get('/api/auth/user').set('x-auth-token', login.body.token).expect(200);
    expect(current.body).toMatchObject({ id: A, name: 'Account A' });
    for (const key of ['password', 'adminNotes', 'suspensionReason', 'googleId']) expect(current.body).not.toHaveProperty(key);
    users.get(A).isSuspended = true;
    await request(app).post('/api/auth/login').send({ email: users.get(A).email, password }).expect(403);
});

test('Google login rejects suspended accounts, invalid credentials and unverified emails', async () => {
    const valid = { email: users.get(A).email, email_verified: true, sub: 'google-account-a', name: 'Account A' };
    mockVerifyGoogle.mockResolvedValue({ getPayload: () => valid });
    await request(app).post('/api/auth/google').send({ credential: 'mocked-oauth-credential' }).expect(200);
    users.get(A).isSuspended = true;
    await request(app).post('/api/auth/google').send({ credential: 'mocked-oauth-credential' }).expect(403);
    users.get(A).isSuspended = false;
    mockVerifyGoogle.mockResolvedValue({ getPayload: () => ({ ...valid, email_verified: false }) });
    await request(app).post('/api/auth/google').send({ credential: 'mocked-oauth-credential' }).expect(401);
    mockVerifyGoogle.mockRejectedValue(new Error('invalid provider credential'));
    await request(app).post('/api/auth/google').send({ credential: 'mocked-oauth-credential' }).expect(401);
});

test('Starter Pack and Smart Fridge require login and only import/suggest public recipes', async () => {
    for (const url of ['/api/meals/import-starter-pack', '/api/meals/suggest', `/api/meals/copy/${PUBLIC}`, '/api/ai/parse']) await request(app).post(url).send({ ingredients: 'carrot', text: 'carrot' }).expect(401);
    const suggestions = await request(app).post('/api/meals/suggest').set('x-auth-token', token(B)).send({ ingredients: 'carrot' }).expect(200);
    expect(suggestions.body.map(meal => meal._id)).toEqual([PUBLIC]);
    await request(app).post('/api/meals/import-starter-pack').set('x-auth-token', token(B)).expect(200);
    const imported = (await request(app).get('/api/meals').set('x-auth-token', token(B))).body;
    expect(imported.map(meal => meal.name)).toEqual(['Public soup']);
});
