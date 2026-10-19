import React, { act, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AddMeal from './AddMeal';
import Login from './auth/Login';
import PrivateRoute from './routing/PrivateRoute';
import { AuthContext, AuthProvider } from '../context/AuthContext';
import { UserDataProvider, useUserData } from '../context/UserDataContext';
import api from '../utils/api';
import { setSessionToken } from '../utils/session';

// CRA's Jest predates package exports. Resolve the installed router's real CJS
// files explicitly; routing behavior itself is not mocked.
jest.mock('react-router/dom', () => jest.requireActual('react-router/dist/development/dom-export.js'), { virtual: true });
jest.mock('react-router-dom', () => jest.requireActual('react-router-dom/dist/index.js'), { virtual: true });

// Keep the actual forms, routing, providers and HTTP interceptors. These controls
// stand in only for unrelated character, image-cropping and ingredient-editor UI.
jest.mock('../context/CarrotContext', () => ({ useCarrot: () => ({ say: jest.fn() }) }));
jest.mock('@react-oauth/google', () => ({ GoogleLogin: () => null }));
jest.mock('./Rustic/ImageCropper', () => () => null);
jest.mock('./Rustic/IngredientManager', () => ({ ingredients, onChange }) => (
    <>
        {/* Match the temporary quantity field's native constraints, separate from saved ingredients. */}
        <input type="number" aria-label="Temporary ingredient quantity" defaultValue="" />
        <textarea aria-label="Ingredients" value={ingredients} onChange={event => onChange(event.target.value)} />
    </>
));
jest.mock('./Rustic/OccasionWheel', () => ({ selected, onSelect }) => (
    <button type="button" onClick={() => onSelect('Dinner')} aria-pressed={selected === 'Dinner'}>Choose Dinner</button>
));

let container, root, originalAdapter, auth, data, location, navigate, requests, serverMeals;
const originalMeal = { _id: 'owned-meal', name: 'Existing soup', ingredients: ['carrot'], category: 'Dinner', imageUrl: '' };
const response = (config, value) => ({ config, status: 200, data: value });
const rejected = (config, status, message) => Promise.reject({ config, response: { status, data: { message } } });
const clone = value => JSON.parse(JSON.stringify(value));

function Screens() {
    auth = useContext(AuthContext);
    data = useUserData();
    location = useLocation();
    navigate = useNavigate();
    return <>
        <output aria-label="Shared meals">{data.meals.map(meal => meal.name).join(', ')}</output>
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<PrivateRoute><AddMeal setMeals={data.setMeals} draftMeal={data.draftMeal} setDraftMeal={data.setDraftMeal} /></PrivateRoute>} />
            <Route path="/available-meals" element={<PrivateRoute><div>Meal gallery</div></PrivateRoute>} />
        </Routes>
    </>;
}

const mount = async (entry = '/') => act(async () => root.render(
    <AuthProvider><MemoryRouter initialEntries={[entry]}><UserDataProvider><Screens /></UserDataProvider></MemoryRouter></AuthProvider>
));
const defaultAdapter = async config => {
    requests.push(config);
    if (config.url === '/auth/login') return response(config, { token: 'account-session-fixture' });
    if (config.url === '/auth/user') return response(config, { id: 'account-a', name: 'Account A' });
    if (config.url === '/meals' && config.method === 'get') return response(config, clone(serverMeals));
    if (config.url === '/meals/owned-meal' && config.method === 'get') return response(config, clone(serverMeals[0]));
    if (config.url === '/meals' && config.method === 'post') {
        const meal = { _id: 'created-meal', name: config.data.get('name'), ingredients: [config.data.get('ingredients')], category: config.data.get('category') };
        serverMeals.push(meal);
        return response(config, clone(meal));
    }
    if (config.url === '/meals/owned-meal' && config.method === 'put') {
        const meal = { ...serverMeals[0], name: config.data.get('name'), ingredients: [config.data.get('ingredients')], category: config.data.get('category') };
        serverMeals[0] = meal;
        return response(config, clone(meal));
    }
    throw new Error('Unexpected fixture endpoint: ' + config.url);
};
const change = async (selector, value) => act(async () => {
    const element = container.querySelector(selector);
    const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
});
const submit = async () => act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
const fillNewMeal = async () => {
    await change('input[name="name"]', 'New stew');
    await change('textarea[aria-label="Ingredients"]', 'potato');
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Choose Dinner').click());
};

beforeEach(() => {
    setSessionToken('account-session-fixture');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    originalAdapter = api.defaults.adapter;
    api.defaults.adapter = defaultAdapter;
    requests = [];
    serverMeals = [clone(originalMeal)];
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    api.defaults.adapter = originalAdapter;
    setSessionToken(null);
    jest.restoreAllMocks();
});

test('editing ignores private fields in legacy browser history and waits for an authenticated ownership read', async () => {
    let finishRead;
    api.defaults.adapter = config => {
        if (config.url === '/meals/owned-meal') {
            requests.push(config);
            return new Promise(resolve => { finishRead = () => resolve(response(config, clone(originalMeal))); });
        }
        return defaultAdapter(config);
    };
    await mount({ pathname: '/', state: { mealToEdit: { _id: 'owned-meal', name: 'Other account private dish', ingredients: ['private ingredient'], imageUrl: '/private-history-image.png', category: 'Dinner' } } });
    expect(container.querySelector('input[name="name"]').value).toBe('');
    expect(container.innerHTML).not.toContain('Other account private dish');
    expect(container.innerHTML).not.toContain('/private-history-image.png');
    await submit();
    expect(requests.filter(config => config.method === 'put' || config.method === 'post')).toHaveLength(0);
    await act(async () => finishRead());
    expect(container.querySelector('input[name="name"]').value).toBe('Existing soup');
    expect(container.querySelector('textarea').value).toBe('carrot');
    expect(requests.find(config => config.url === '/meals/owned-meal').headers.get('x-auth-token')).toBe('account-session-fixture');
});

test('a rejected ownership read redirects to the gallery and clears the untrusted history state', async () => {
    api.defaults.adapter = config => config.url === '/meals/private-id'
        ? rejected(config, 404, 'Meal not found') : defaultAdapter(config);
    await mount({ pathname: '/', state: { mealToEdit: { _id: 'private-id', name: 'Other account private dish' } } });
    expect(location.pathname).toBe('/available-meals');
    expect(location.state).toBeNull();
    expect(container.textContent).toContain('Meal gallery');
    expect(container.textContent).not.toContain('Other account private dish');
    expect(container.querySelector('form')).toBeNull();
});

test('saving an authorized edit updates shared meal data and clears edit history and the draft', async () => {
    await mount({ pathname: '/', state: { mealId: 'owned-meal' } });
    await change('input[name="name"]', 'Updated soup');
    await submit();
    expect(requests.filter(config => config.method === 'put')).toHaveLength(1);
    expect(data.meals.map(meal => meal.name)).toEqual(['Updated soup']);
    expect(data.draftMeal.name).toBe('');
    expect(location.state).toBeNull();
    expect(container.querySelector('input[name="name"]').value).toBe('');
});

test('creating a meal updates the shared collection without losing existing meals', async () => {
    await mount();
    await fillNewMeal();
    await submit();
    expect(requests.filter(config => config.method === 'post' && config.url === '/meals')).toHaveLength(1);
    expect(data.meals.map(meal => meal.name)).toEqual(['Existing soup', 'New stew']);
    expect(data.draftMeal.name).toBe('');
    expect(container.querySelector('input[name="name"]').value).toBe('');
});

test('the Save Recipe button retains the existing save action despite unfinished temporary ingredient input', async () => {
    await mount();
    await fillNewMeal();
    await change('input[aria-label="Temporary ingredient quantity"]', '0.5');
    expect(container.querySelector('input[aria-label="Temporary ingredient quantity"]').validity.stepMismatch).toBe(true);

    const saveButton = container.querySelector('img[alt="Save Recipe"]').closest('button');
    await act(async () => saveButton.click());

    const saves = requests.filter(config => config.method === 'post' && config.url === '/meals');
    expect(saves).toHaveLength(1);
    expect(saves[0].data.get('ingredients')).toBe('potato');
    expect(data.meals.map(meal => meal.name)).toEqual(['Existing soup', 'New stew']);
});

test('editing an existing meal never uploads an unrelated creation draft photo or crop', async () => {
    await mount('/available-meals');
    await act(async () => {
        data.setDraftMeal({ name: 'Unfinished dish', ingredients: 'potato', category: 'Lunch', image: new File(['fixture image'], 'draft-photo.png', { type: 'image/png' }), previewUrl: '/draft-photo.png', imageCrop: JSON.stringify({ x: 10, y: 20, width: 30, height: 40 }) });
        navigate('/', { state: { mealId: 'owned-meal' } });
    });
    expect(container.querySelector('input[name="name"]').value).toBe('Existing soup');
    expect(container.querySelector('input[placeholder="Upload Photo"]').value).toBe('');
    await submit();
    const saved = requests.find(config => config.method === 'put');
    expect(saved).toBeDefined();
    expect(saved.data.has('image')).toBe(false);
    expect(saved.data.has('cropX')).toBe(false);
    expect(data.meals.map(meal => meal.name)).toEqual(['Existing soup']);
});

test('saving before initial meal hydration reloads all meals and a late initial response cannot erase the save', async () => {
    let finishInitial, initial = true;
    api.defaults.adapter = config => {
        if (config.url === '/meals' && config.method === 'get' && initial) {
            initial = false;
            requests.push(config);
            return new Promise(resolve => { finishInitial = () => resolve(response(config, [clone(originalMeal)])); });
        }
        return defaultAdapter(config);
    };
    await mount();
    expect(data.mealsLoading).toBe(true);
    await fillNewMeal();
    await submit();
    expect(data.meals.map(meal => meal.name)).toEqual(['Existing soup', 'New stew']);
    expect(data.mealsLoading).toBe(false);
    await act(async () => finishInitial());
    expect(data.meals.map(meal => meal.name)).toEqual(['Existing soup', 'New stew']);
});

test('the actual login form retains its invalid-credentials feedback after a rejected sign-in', async () => {
    setSessionToken(null);
    api.defaults.adapter = config => {
        requests.push(config);
        return rejected(config, 401, 'Invalid Credentials');
    };
    await mount('/login');
    await change('input[name="email"]', 'account@example.invalid');
    await change('input[name="password"]', ['fixture', 'only'].join('-'));
    await submit();
    expect(location.pathname).toBe('/login');
    expect(container.querySelector('[role="alert"]').textContent).toContain('Invalid Credentials');
    expect(auth.isAuthenticated).toBe(false);
    expect(requests).toHaveLength(1);
    expect(requests[0].headers.get('x-auth-token')).toBeUndefined();
});

test('login navigation waits for account verification before exposing a protected form or loading private meals', async () => {
    let finishAccount;
    setSessionToken(null);
    api.defaults.adapter = config => {
        if (config.url === '/auth/user') {
            requests.push(config);
            return new Promise(resolve => { finishAccount = () => resolve(response(config, { id: 'account-a', name: 'Account A' })); });
        }
        return defaultAdapter(config);
    };
    await mount('/login');
    await change('input[name="email"]', 'account@example.invalid');
    await change('input[name="password"]', ['fixture', 'only'].join('-'));
    await submit();
    expect(location.pathname).toBe('/');
    expect(container.textContent).toContain('Loading...');
    expect(container.querySelector('input[name="name"]')).toBeNull();
    expect(requests.some(config => config.url === '/meals')).toBe(false);
    await act(async () => finishAccount());
    expect(auth.isAuthenticated).toBe(true);
    expect(container.querySelector('input[name="name"]')).not.toBeNull();
    expect(data.meals.map(meal => meal.name)).toEqual(['Existing soup']);
});
