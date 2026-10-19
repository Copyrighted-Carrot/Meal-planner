import React, { act, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AddMeal from './AddMeal';
import Login from './auth/Login';
import Register from './auth/Register';
import PrivateRoute from './routing/PrivateRoute';
import { AuthContext, AuthProvider } from '../context/AuthContext';
import { UserDataProvider, useUserData } from '../context/UserDataContext';
import api from '../utils/api';
import { setSessionToken } from '../utils/session';

jest.mock('react-router/dom', () => jest.requireActual('react-router/dist/development/dom-export.js'), { virtual: true });
jest.mock('react-router-dom', () => jest.requireActual('react-router-dom/dist/index.js'), { virtual: true });

const mockSay = jest.fn();
let mockGoogleProps;
jest.mock('../context/CarrotContext', () => ({ useCarrot: () => ({ say: mockSay }) }));
// Exercise only the SDK callbacks; this is not a live Google OAuth test.
jest.mock('@react-oauth/google', () => ({ GoogleLogin: props => { mockGoogleProps = props; return null; } }));
jest.mock('./Rustic/ImageCropper', () => () => null);
jest.mock('./Rustic/IngredientManager', () => ({ ingredients, onChange }) => (
    <>
        <input type="number" aria-label="Temporary ingredient quantity" defaultValue="" />
        <textarea aria-label="Ingredients" value={ingredients} onChange={event => onChange(event.target.value)} />
    </>
));
jest.mock('./Rustic/OccasionWheel', () => ({ selected, onSelect }) => (
    <button type="button" onClick={() => onSelect('Dinner')} aria-pressed={selected === 'Dinner'}>Choose Dinner</button>
));

let container, root, originalAdapter, requests, serverMeals, auth, data, location;
const originalMeal = { _id: 'owned-meal', name: 'Garden soup', ingredients: ['carrot'], category: 'Dinner', imageUrl: '' };
const copy = value => JSON.parse(JSON.stringify(value));
const response = (config, value) => ({ config, status: 200, data: value });
const failure = (config, status, message) => ({ config, response: { status, data: { message } } });
const writes = () => requests.filter(config => /^(post|put)$/.test(config.method));
const alert = () => container.querySelector('[role="alert"]');
const status = () => [...container.querySelectorAll('[role="status"]')].map(element => element.textContent).join(' ');
const form = () => container.querySelector('form');
const dispatchSubmit = () => form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
const saveButton = () => container.querySelector('.recipe-save-button');

function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

function Screens() {
    auth = useContext(AuthContext);
    data = useUserData();
    location = useLocation();
    return <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<PrivateRoute><AddMeal setMeals={data.setMeals} draftMeal={data.draftMeal} setDraftMeal={data.setDraftMeal} /></PrivateRoute>} />
        <Route path="/available-meals" element={<PrivateRoute><div>Meal gallery</div></PrivateRoute>} />
    </Routes>;
}

const mount = async (entry = '/') => act(async () => root.render(
    <AuthProvider><MemoryRouter initialEntries={[entry]}><UserDataProvider><Screens /></UserDataProvider></MemoryRouter></AuthProvider>
));

async function defaultAdapter(config) {
    requests.push(config);
    if (/^\/auth\/(login|register|google)$/.test(config.url)) return response(config, { token: 'form-feedback-account-fixture' });
    if (config.url === '/auth/user') return response(config, { id: 'form-account', name: 'Fixture Cook' });
    if (config.url === '/meals' && config.method === 'get') return response(config, copy(serverMeals));
    if (config.url === '/meals/owned-meal' && config.method === 'get') return response(config, copy(serverMeals[0]));
    if (config.url === '/meals' && config.method === 'post') {
        const meal = { _id: 'new-meal', name: config.data.get('name'), ingredients: [config.data.get('ingredients')], category: config.data.get('category') };
        serverMeals.push(meal);
        return response(config, copy(meal));
    }
    if (config.url === '/meals/owned-meal' && config.method === 'put') {
        serverMeals[0] = { ...serverMeals[0], name: config.data.get('name'), ingredients: [config.data.get('ingredients')], category: config.data.get('category') };
        return response(config, copy(serverMeals[0]));
    }
    throw new Error('Unexpected fixture endpoint: ' + config.url);
}

async function change(selector, value) {
    await act(async () => {
        const element = container.querySelector(selector);
        const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function fillAuth(register = false) {
    if (register) await change('input[name="name"]', 'Fixture Cook');
    await change('input[name="email"]', 'form@example.invalid');
    await change('input[name="password"]', 'fixture-password');
    if (register) await change('input[name="confirmPassword"]', 'fixture-password');
}

async function fillMeal({ name = true, ingredients = true, category = true } = {}) {
    if (name) await change('input[name="name"]', 'New stew');
    if (ingredients) await change('textarea[aria-label="Ingredients"]', 'potato');
    if (category) await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Choose Dinner').click());
}

beforeEach(() => {
    setSessionToken('form-feedback-account-fixture');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    originalAdapter = api.defaults.adapter;
    api.defaults.adapter = defaultAdapter;
    requests = [];
    serverMeals = [copy(originalMeal)];
    mockSay.mockClear();
    mockGoogleProps = undefined;
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    api.defaults.adapter = originalAdapter;
    setSessionToken(null);
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test.each([[401, 'Invalid Credentials'], [503, 'Sign-in service unavailable']])('Login keeps a visible error for status %s and retains entered values', async (code, message) => {
    jest.useFakeTimers();
    setSessionToken(null);
    api.defaults.adapter = config => {
        requests.push(config);
        return Promise.reject(failure(config, code, message));
    };
    await mount('/login');
    await fillAuth();
    await act(async () => dispatchSubmit());
    expect(alert().textContent).toContain(message);
    await act(async () => jest.advanceTimersByTime(6000));
    expect(alert().textContent).toContain(message);
    expect(container.querySelector('input[name="email"]').value).toBe('form@example.invalid');
    expect(container.querySelector('input[name="password"]').value).toBe('fixture-password');
    expect(location.pathname).toBe('/login');
    expect(auth.isAuthenticated).toBe(false);
    expect(mockSay).toHaveBeenCalled();
});

test('Login announces pending work and guards two submissions before rerender', async () => {
    setSessionToken(null);
    const pending = deferred();
    api.defaults.adapter = config => config.url === '/auth/login'
        ? (requests.push(config), pending.promise.then(() => response(config, { token: 'form-feedback-account-fixture' })))
        : defaultAdapter(config);
    await mount('/login');
    await fillAuth();
    await act(async () => { dispatchSubmit(); dispatchSubmit(); });
    expect(writes()).toHaveLength(1);
    expect(status()).toMatch(/signing in/i);
    expect(container.querySelector('button[type="submit"]').disabled).toBe(true);
    await act(async () => pending.resolve());
    expect(location.pathname).toBe('/');
    expect(auth.isAuthenticated).toBe(true);
    expect(mockSay.mock.calls.some(([message]) => /welcome back/i.test(message))).toBe(true);
});

test('Register mismatch is persistent, associated with confirmation, and sends no request', async () => {
    jest.useFakeTimers();
    setSessionToken(null);
    await mount('/register');
    await fillAuth(true);
    await change('input[name="confirmPassword"]', 'different-fixture-password');
    await act(async () => dispatchSubmit());
    expect(alert().textContent).toMatch(/passwords.*not match/i);
    const confirmation = container.querySelector('input[name="confirmPassword"]');
    expect(confirmation.getAttribute('aria-invalid')).toBe('true');
    expect(confirmation.getAttribute('aria-describedby').split(/\s+/)).toContain(alert().id);
    expect(confirmation.minLength).toBe(6);
    expect(confirmation.required).toBe(true);
    await act(async () => jest.advanceTimersByTime(6000));
    expect(alert().textContent).toMatch(/passwords.*not match/i);
    expect(writes()).toHaveLength(0);
    expect(mockSay).toHaveBeenCalled();
});

test('Register service errors remain visible without clearing the completed form', async () => {
    jest.useFakeTimers();
    setSessionToken(null);
    api.defaults.adapter = config => {
        requests.push(config);
        return Promise.reject(failure(config, 503, 'Registration service unavailable'));
    };
    await mount('/register');
    await fillAuth(true);
    await act(async () => dispatchSubmit());
    expect(alert().textContent).toContain('Registration service unavailable');
    await act(async () => jest.advanceTimersByTime(6000));
    expect(alert().textContent).toContain('Registration service unavailable');
    expect(container.querySelector('input[name="name"]').value).toBe('Fixture Cook');
    expect(container.querySelector('input[name="confirmPassword"]').value).toBe('fixture-password');
    expect(location.pathname).toBe('/register');
    expect(mockSay).toHaveBeenCalled();
});

test('Register announces pending work, prevents duplicate submissions, and keeps successful navigation', async () => {
    setSessionToken(null);
    const pending = deferred();
    api.defaults.adapter = config => config.url === '/auth/register'
        ? (requests.push(config), pending.promise.then(() => response(config, { token: 'form-feedback-account-fixture' })))
        : defaultAdapter(config);
    await mount('/register');
    await fillAuth(true);
    await act(async () => { dispatchSubmit(); dispatchSubmit(); });
    expect(writes()).toHaveLength(1);
    expect(status()).toMatch(/registering|creating.*account/i);
    expect(container.querySelector('button[type="submit"]').disabled).toBe(true);
    await act(async () => pending.resolve());
    expect(location.pathname).toBe('/');
    expect(auth.isAuthenticated).toBe(true);
});

test.each([['/login', 'email'], ['/register', 'name']])('%s preserves native required validation and exposes its feedback', async (route, fieldName) => {
    setSessionToken(null);
    await mount(route);
    const field = container.querySelector(`input[name="${fieldName}"]`);
    expect(field.required).toBe(true);
    await act(async () => expect(form().checkValidity()).toBe(false));
    expect(alert().textContent).toContain(field.validationMessage);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby').split(/\s+/)).toContain(alert().id);
    expect(writes()).toHaveLength(0);
});

test.each(['/login', '/register'])('%s displays a Google SDK callback failure independently of character speech', async route => {
    setSessionToken(null);
    await mount(route);
    await act(async () => mockGoogleProps.onError());
    expect(alert().textContent).toMatch(/google.*failed|could not.*google/i);
    expect(location.pathname).toBe(route);
    expect(writes()).toHaveLength(0);
    expect(mockSay).toHaveBeenCalled();
});

test.each(['/login', '/register'])('%s guards duplicate Google credential callbacks and shows exchange failure', async route => {
    setSessionToken(null);
    const pending = deferred();
    api.defaults.adapter = config => {
        requests.push(config);
        return pending.promise.then(() => Promise.reject(failure(config, 503, 'Google exchange unavailable')));
    };
    await mount(route);
    await act(async () => {
        mockGoogleProps.onSuccess({ credential: 'fixture-google-credential' });
        mockGoogleProps.onSuccess({ credential: 'fixture-google-credential' });
    });
    expect(writes()).toHaveLength(1);
    expect(writes()[0].url).toBe('/auth/google');
    expect(status()).toMatch(/google|signing in|registering/i);
    expect(container.querySelector('button[type="submit"]').disabled).toBe(true);
    await act(async () => pending.resolve());
    expect(alert().textContent).toMatch(/google|exchange|failed/i);
    expect(location.pathname).toBe(route);
    expect(mockSay).toHaveBeenCalled();
});

test.each([
    ['name', { name: false }, /name/i],
    ['ingredients', { ingredients: false }, /ingredient/i],
    ['category', { category: false }, /occasion|category|breakfast|lunch|dinner/i],
])('Add Meal keeps missing %s feedback on the form and performs no save', async (_field, missing, expected) => {
    jest.useFakeTimers();
    await mount();
    await fillMeal(missing);
    await act(async () => saveButton().click());
    expect(alert().textContent).toMatch(expected);
    expect(form().getAttribute('aria-describedby').split(/\s+/)).toContain(alert().id);
    await act(async () => jest.advanceTimersByTime(6000));
    expect(alert().textContent).toMatch(expected);
    expect(writes()).toHaveLength(0);
    expect(mockSay).toHaveBeenCalled();
});

test.each(['click', 'submit'])('Add Meal guards rapid double %s and stays pending until the save completes', async action => {
    const pending = deferred();
    api.defaults.adapter = config => config.url === '/meals' && config.method === 'post'
        ? (requests.push(config), pending.promise.then(() => {
            const meal = { _id: 'new-meal', name: config.data.get('name'), ingredients: ['potato'], category: 'Dinner' };
            serverMeals.push(meal);
            return response(config, meal);
        }))
        : defaultAdapter(config);
    await mount();
    await fillMeal();
    await act(async () => {
        if (action === 'click') { saveButton().click(); saveButton().click(); }
        else { dispatchSubmit(); dispatchSubmit(); }
    });
    expect(writes()).toHaveLength(1);
    expect(saveButton().disabled).toBe(true);
    expect(saveButton().type).toBe('button');
    expect(status()).toMatch(/saving/i);
    expect(form().getAttribute('aria-busy')).toBe('true');
    await act(async () => pending.resolve());
    expect(data.meals.map(meal => meal.name)).toEqual(['Garden soup', 'New stew']);
    expect(data.draftMeal.name).toBe('');
    expect(location.pathname).toBe('/');
    expect(container.querySelector('input[name="name"]').value).toBe('');
    expect(saveButton().disabled).toBe(false);
    expect(status()).toMatch(/meal added successfully/i);
    expect(form().getAttribute('aria-busy')).toBe('false');
    expect(mockSay.mock.calls.some(([message]) => /meal added successfully/i.test(message))).toBe(true);
});

test.each(['add', 'edit'])('%s meal service failure keeps the recipe and a visible retryable error', async mode => {
    jest.useFakeTimers();
    api.defaults.adapter = config => /^(post|put)$/.test(config.method)
        ? (requests.push(config), Promise.reject(failure(config, 503, 'Recipe service unavailable')))
        : defaultAdapter(config);
    await mount(mode === 'edit' ? { pathname: '/', state: { mealId: 'owned-meal' } } : '/');
    await fillMeal();
    await act(async () => saveButton().click());
    expect(alert().textContent).toMatch(/Recipe service unavailable|could not.*save|failed.*save/i);
    await act(async () => jest.advanceTimersByTime(6000));
    expect(alert()).not.toBeNull();
    expect(container.querySelector('input[name="name"]').value).toBe('New stew');
    expect(container.querySelector('textarea[aria-label="Ingredients"]').value).toBe('potato');
    expect(saveButton().disabled).toBe(false);
    expect(location.pathname).toBe('/');
    expect(data.meals.map(meal => meal.name)).toEqual(['Garden soup']);
    expect(writes()).toHaveLength(1);
    expect(writes()[0].method).toBe(mode === 'edit' ? 'put' : 'post');
    expect(mockSay.mock.calls.some(([message]) => /oops|failed|unavailable/i.test(message))).toBe(true);
});

test('authorized edit loading is visible and prevents writes until ownership read finishes', async () => {
    const pending = deferred();
    api.defaults.adapter = config => config.url === '/meals/owned-meal' && config.method === 'get'
        ? (requests.push(config), pending.promise.then(() => response(config, copy(originalMeal))))
        : defaultAdapter(config);
    await mount({ pathname: '/', state: { mealId: 'owned-meal' } });
    expect(status()).toMatch(/loading.*meal/i);
    expect(saveButton().disabled).toBe(true);
    await act(async () => { saveButton().click(); dispatchSubmit(); });
    expect(writes()).toHaveLength(0);
    await act(async () => pending.resolve());
    expect(container.querySelector('input[name="name"]').value).toBe('Garden soup');
    expect(saveButton().disabled).toBe(false);
    expect(status()).not.toMatch(/loading.*meal/i);
});

test('successful edit keeps shared data and the existing two-second gallery return', async () => {
    jest.useFakeTimers();
    await mount({ pathname: '/', state: { mealId: 'owned-meal' } });
    await change('input[name="name"]', 'Updated soup');
    await act(async () => saveButton().click());
    expect(writes()).toHaveLength(1);
    expect(writes()[0].method).toBe('put');
    expect(data.meals.map(meal => meal.name)).toEqual(['Updated soup']);
    expect(data.draftMeal.name).toBe('');
    expect(location.state).toBeNull();
    expect(location.pathname).toBe('/');
    expect(status()).toMatch(/meal updated successfully/i);
    expect(mockSay.mock.calls.some(([message]) => /meal updated successfully/i.test(message))).toBe(true);
    await act(async () => jest.advanceTimersByTime(1999));
    expect(location.pathname).toBe('/');
    await act(async () => jest.advanceTimersByTime(1));
    expect(location.pathname).toBe('/available-meals');
    expect(container.textContent).toContain('Meal gallery');
});
