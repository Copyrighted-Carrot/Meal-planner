const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

// Exercise the real login route and middleware without loading data or providers.
jest.mock('../models/User', () => ({}));
jest.mock('../models/Meal', () => ({}));
jest.mock('../models/SystemLog', () => ({}));
jest.mock('../models/ErrorLog', () => ({}));
jest.mock('mongoose', () => ({}));
jest.mock('cloudinary', () => ({ v2: {} }));

const adminAuth = require('../middleware/adminAuth');
const app = express();
app.use(express.json());
app.use('/api/admin', require('../routes/adminRoutes'));
app.get('/protected-admin', adminAuth, (req, res) => res.json({ admin: req.admin }));

const adminIdentity = () => ({ id: 'shadow_master', role: 'admin' });
const configuredKeys = ['ADMIN_MASTER_PASSWORD', 'ADMIN_JWT_SECRET'];
let previousEnvironment;
beforeEach(() => {
    previousEnvironment = Object.fromEntries(configuredKeys.map(key => [key, process.env[key]]));
    for (const key of configuredKeys) process.env[key] = crypto.randomBytes(32).toString('hex');
});
afterEach(() => {
    for (const key of configuredKeys) {
        if (previousEnvironment[key] === undefined) delete process.env[key];
        else process.env[key] = previousEnvironment[key];
    }
    jest.restoreAllMocks();
});

test.each(configuredKeys)('login fails closed when %s is unset, empty or whitespace', async key => {
    for (const value of [undefined, '', '   ']) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
        const response = await request(app).post('/api/admin/login').send({}).expect(503);
        expect(response.body).toEqual({ msg: 'Manager access is unavailable.' });
        expect(response.body).not.toHaveProperty('token');
    }
});

test('configured login rejects absent, blank, non-string and incorrect input', async () => {
    for (const value of [undefined, '', '   ', null, {}, [], 42, crypto.randomBytes(32).toString('hex')]) {
        const body = value === undefined ? {} : { password: value };
        const response = await request(app).post('/api/admin/login').send(body).expect(401);
        expect(response.body).toEqual({ msg: '⛔ Access Denied.' });
        expect(response.body).not.toHaveProperty('token');
    }
    await request(app).post('/api/admin/login').expect(401);
});

test('correct configured login issues an expiring HS256 token that grants manager access', async () => {
    const response = await request(app).post('/api/admin/login')
        .send({ password: process.env.ADMIN_MASTER_PASSWORD }).expect(200);
    const decoded = jwt.verify(response.body.token, process.env.ADMIN_JWT_SECRET, { algorithms: ['HS256'] });
    expect(decoded.admin).toEqual(adminIdentity());
    expect(decoded.exp - decoded.iat).toBe(24 * 60 * 60);
    expect(jwt.decode(response.body.token, { complete: true }).header.alg).toBe('HS256');
    const protectedResponse = await request(app).get('/protected-admin').set('x-admin-token', response.body.token).expect(200);
    expect(protectedResponse.body).toEqual({ admin: adminIdentity() });
});

test.each(['callback', 'throw'])('a signing %s failure returns safe JSON without exposing the underlying error', async kind => {
    jest.spyOn(jwt, 'sign').mockImplementation((payload, secret, options, callback) => {
        const error = new Error('Internal signing detail');
        if (kind === 'throw') throw error;
        callback(error);
    });
    const response = await request(app).post('/api/admin/login')
        .send({ password: process.env.ADMIN_MASTER_PASSWORD }).expect(500);
    expect(response.body).toEqual({ msg: 'Unable to sign in. Please try again.' });
});

test('protected manager functionality fails closed if the signing secret becomes unavailable', async () => {
    const credential = jwt.sign({ admin: adminIdentity() }, process.env.ADMIN_JWT_SECRET, { expiresIn: '1h' });
    for (const value of [undefined, '', '   ']) {
        if (value === undefined) delete process.env.ADMIN_JWT_SECRET;
        else process.env.ADMIN_JWT_SECRET = value;
        const response = await request(app).get('/protected-admin').set('x-admin-token', credential).expect(503);
        expect(response.body).toEqual({ msg: 'Manager access is unavailable.' });
    }
});

test('protected manager functionality rejects absent, malformed, expired and wrong-secret tokens', async () => {
    await request(app).get('/protected-admin').expect(401);
    const invalidTokens = [
        'not-a-signed-token',
        jwt.sign({ admin: adminIdentity() }, process.env.ADMIN_JWT_SECRET, { expiresIn: -1 }),
        jwt.sign({ admin: adminIdentity() }, crypto.randomBytes(32).toString('hex'), { expiresIn: '1h' })
    ];
    for (const credential of invalidTokens) await request(app).get('/protected-admin').set('x-admin-token', credential).expect(401);
});

test('a normal user token never grants manager access, even if the two signing secrets match', async () => {
    for (const secret of [process.env.JWT_SECRET, process.env.ADMIN_JWT_SECRET]) {
        const credential = jwt.sign({ user: { id: '111111111111111111111111' } }, secret, { expiresIn: '1h' });
        await request(app).get('/protected-admin').set('x-admin-token', credential).expect(401);
    }
});

test('signed tokens must contain the exact manager identity, role and an expiration', async () => {
    const invalidPayloads = [
        {},
        { admin: { id: 'someone_else', role: 'admin' } },
        { admin: { id: 'shadow_master', role: 'user' } },
        { admin: 'shadow_master' }
    ];
    for (const payload of invalidPayloads) {
        const credential = jwt.sign(payload, process.env.ADMIN_JWT_SECRET, { expiresIn: '1h' });
        await request(app).get('/protected-admin').set('x-admin-token', credential).expect(401);
    }
    const noExpiry = jwt.sign({ admin: adminIdentity() }, process.env.ADMIN_JWT_SECRET);
    await request(app).get('/protected-admin').set('x-admin-token', noExpiry).expect(401);
});

test('a different HMAC algorithm is rejected even with a valid manager payload and signature', async () => {
    const credential = jwt.sign({ admin: adminIdentity() }, process.env.ADMIN_JWT_SECRET, { algorithm: 'HS384', expiresIn: '1h' });
    await request(app).get('/protected-admin').set('x-admin-token', credential).expect(401);
});
