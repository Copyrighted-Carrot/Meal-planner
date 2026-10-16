import api, { adminApi } from './api';
import { resolveApiBaseUrl } from './apiConfig';
import { captureSession, isCurrentSession, setSessionToken, subscribeSession } from './session';

const response = (config, data = []) => ({ config, data, status: 200, statusText: 'OK', headers: {} });
const failure = (config, status = 401) => ({ config, response: { status, data: { message: 'Session expired' } } });
beforeEach(() => setSessionToken(null));

test('API configuration defaults to the website origin and accepts an explicit deployment URL', () => {
    expect(resolveApiBaseUrl('')).toBe('/api');
    expect(resolveApiBaseUrl('https://api.example.invalid/api/')).toBe('https://api.example.invalid/api');
    expect(() => resolveApiBaseUrl('//other.example.invalid/api')).toThrow();
    expect(() => resolveApiBaseUrl('javascript:void(0)')).toThrow();
});

test('protected requests attach the current token and replace caller-supplied auth headers', async () => {
    setSessionToken('account-a-fixture');
    let received;
    await api.get('/meals', { headers: { 'X-Auth-Token': 'outdated-fixture' }, adapter: config => { received = config; return Promise.resolve(response(config)); } });
    expect(received.baseURL).toBe('/api');
    expect(received.headers.get('x-auth-token')).toBe('account-a-fixture');
});

test('public login requests do not send a user token or invalidate an existing session on 401', async () => {
    setSessionToken('account-b-fixture');
    await expect(api.post('/auth/login', {}, { adapter: config => {
        expect(config.headers.get('x-auth-token')).toBeUndefined();
        return Promise.reject(failure(config));
    } })).rejects.toMatchObject({ statusCode: 401 });
    expect(captureSession().token).toBe('account-b-fixture');
});

test('a current protected 401 clears storage and notifies subscribers without exposing request data', async () => {
    setSessionToken('account-a-fixture');
    const listener = jest.fn();
    const unsubscribe = subscribeSession(listener);
    const error = await api.get('/meals', { adapter: config => Promise.reject(failure(config)) }).catch(value => value);
    expect(error.statusCode).toBe(401);
    expect(error.originalError).toBeUndefined();
    expect(error.config).toBeUndefined();
    expect(captureSession().token).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
});

test.each([true, false])('an old session response cannot affect a newer session (success=%s)', async success => {
    setSessionToken('account-a-fixture');
    let complete;
    const pending = api.get('/meals', { adapter: config => new Promise((resolve, reject) => {
        complete = () => success ? resolve(response(config, ['private A meal'])) : reject(failure(config));
    }) }).catch(error => error);
    await Promise.resolve();
    await Promise.resolve();
    setSessionToken('account-b-fixture');
    complete();
    expect(await pending).toMatchObject({ code: 'SESSION_CHANGED' });
    expect(captureSession().token).toBe('account-b-fixture');
});

test('same-token logout/relogin still invalidates an earlier request generation', () => {
    setSessionToken('same-fixture');
    const earlier = captureSession();
    setSessionToken(null);
    setSessionToken('same-fixture');
    expect(isCurrentSession(earlier)).toBe(false);
});

test('user credentials cannot be sent to an arbitrary absolute URL', async () => {
    const adapter = jest.fn();
    await expect(api.get('https://other.example.invalid/api', { adapter })).rejects.toThrow();
    expect(adapter).not.toHaveBeenCalled();
});

test('manager transport shares configuration without using the user token', async () => {
    setSessionToken('account-a-fixture');
    await adminApi.get('/admin/stats', { adapter: config => {
        expect(config.baseURL).toBe('/api');
        expect(config.headers.get('x-auth-token')).toBeUndefined();
        return Promise.resolve(response(config));
    } });
});

test('plain-text rate limits keep their retry guidance without invalidating the session', async () => {
    setSessionToken('account-a-fixture');
    const message = 'Too many login attempts. You have 15 minutes left.';
    await expect(api.post('/auth/login', {}, { adapter: config => Promise.reject({ config, response: { status: 429, data: message } }) }))
        .rejects.toMatchObject({ message, statusCode: 429 });
    expect(captureSession().token).toBe('account-a-fixture');
});
