const request = require('supertest');
const express = require('express');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const loginLimiter = require('../middleware/loginLimiter');

jest.mock('../models/User');
jest.mock('../utils/usageLogger', () => jest.fn());

// Exercise the real limiter, routes, controller and authentication service.
// The database is isolated; no existing account or provider is contacted.
const app = express();
app.use(express.json());
app.use('/api/auth', require('../routes/authRoutes'));
app.use(require('../middleware/errorHandler'));

let email, password;
beforeEach(() => {
    jest.clearAllMocks();
    email = `${crypto.randomBytes(12).toString('hex')}@example.invalid`;
    password = crypto.randomBytes(20).toString('hex');
    User.findOne.mockResolvedValue(null);
});
afterEach(() => loginLimiter.resetKey(email));

test('ten failed logins remain identical 401 responses, then the real limiter reports a timed lockout', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const result = await request(app).post('/api/auth/login').send({ email, password }).expect(401);
        expect(result.body).toEqual({ message: 'Invalid Credentials' });
    }

    const blocked = await request(app).post('/api/auth/login').send({ email, password }).expect(429);
    expect(blocked.text).toMatch(/^Too many login attempts\. You have \d+ minutes left\.$/);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(User.findOne).toHaveBeenCalledTimes(10);
});

test('a successful login resets earlier failed attempts without weakening the next lockout', async () => {
    const user = {
        id: '111111111111111111111111',
        name: 'Limiter test account',
        email,
        password: await bcrypt.hash(password, 4),
        isSuspended: false,
        save: jest.fn(async () => {})
    };
    User.findOne.mockResolvedValue(user);
    const incorrect = crypto.randomBytes(20).toString('hex');
    for (let attempt = 0; attempt < 9; attempt += 1) {
        await request(app).post('/api/auth/login').send({ email, password: incorrect }).expect(401);
    }
    await request(app).post('/api/auth/login').send({ email, password }).expect(200);
    for (let attempt = 0; attempt < 10; attempt += 1) {
        await request(app).post('/api/auth/login').send({ email, password: incorrect }).expect(401);
    }
    await request(app).post('/api/auth/login').send({ email, password: incorrect }).expect(429);
});
