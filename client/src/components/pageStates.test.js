import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { UserDataProvider, useUserData } from '../context/UserDataContext';
import { setSessionToken } from '../utils/session';
import { weekForDate } from '../utils/planDate';
import api from '../utils/api';
import MealList from './MealList';
import GlobalMealList from './GlobalMealList';
import MealPlanner from './MealPlanner';
import GroceryList from './GroceryList';

jest.mock('react-router/dom', () => jest.requireActual('react-router/dist/development/dom-export.js'), { virtual: true });
jest.mock('react-router-dom', () => jest.requireActual('react-router-dom/dist/index.js'), { virtual: true });
jest.mock('jspdf', () => ({ jsPDF: jest.fn() }));
jest.mock('jspdf-autotable', () => jest.fn());

const weekStart = weekForDate();
const meal = { _id: 'page-state-meal', name: 'Garden soup', category: 'Lunch', ingredients: ['2 carrots'] };
const plan = { _id: 'page-state-plan', weekStart, revision: 2,
    plan: [{ day: 'Monday', breakfast: null, lunch: meal, dinner: null, snack: null }] };
const emptyPlan = { weekStart, revision: 0, plan: [] };
const grocery = { _id: 'page-state-grocery', weekStart, revision: 3, sourcePlanRevision: 2,
    items: [{ _id: 'page-state-item', name: 'Carrots', amount: '2', checked: false }] };
const reply = (config, data) => ({ config, status: 200, data });
const failure = (config, message) => ({ config, response: { status: 503, data: { message } } });
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
let root, container, originalAdapter, respond, requests, userData;
const count = (url, method = 'get') => requests.filter(config => config.url === url && config.method === method).length;
const button = text => [...container.querySelectorAll('button')].find(element => element.textContent.includes(text));
const click = async element => act(async () => element.click());
const text = () => container.textContent;
const status = () => container.querySelector('[role="status"]');
const alert = () => container.querySelector('[role="alert"]');
const emptyRegion = () => container.querySelector('.page-state-empty');
const defaultResponse = config => {
    if (config.url === '/meals') return Promise.resolve(reply(config, [meal]));
    if (config.url === '/plan') return Promise.resolve(reply(config, plan));
    if (config.url === '/grocery') return Promise.resolve(reply(config, [grocery]));
    if (config.url === '/meals/global') return Promise.resolve(reply(config, []));
    throw new Error(`Unexpected test request: ${config.method} ${config.url}`);
};
function Screen({ name }) {
    userData = useUserData();
    if (name === 'meals') return <MealList />;
    if (name === 'browse') return <GlobalMealList meals={userData.meals} onImport={userData.refreshMeals} />;
    if (name === 'planner') return <MealPlanner meals={userData.meals} />;
    return <GroceryList />;
}
const mount = async name => act(async () => root.render(
    <MemoryRouter><AuthContext.Provider value={{ isAuthenticated: true, sessionId: 'page-states', user: { id: 'page-states' } }}>
        <UserDataProvider><Screen name={name} /></UserDataProvider>
    </AuthContext.Provider></MemoryRouter>
));

beforeEach(() => {
    sessionStorage.clear();
    setSessionToken('page-state-fixture');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    originalAdapter = api.defaults.adapter;
    requests = [];
    respond = defaultResponse;
    api.defaults.adapter = config => { requests.push(config); return respond(config); };
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    api.defaults.adapter = originalAdapter;
    setSessionToken(null);
    sessionStorage.clear();
});

test('Available Meals distinguishes initial loading from genuine empty and offers existing destinations', async () => {
    const pending = deferred();
    respond = config => pending.promise.then(data => reply(config, data));
    await mount('meals');
    expect(container.querySelector('h1').textContent.trim()).toBe('Available Meals');
    expect(container.querySelector('h1 [aria-hidden="true"] img')).not.toBeNull();
    expect(status().textContent).toContain('Loading your meals');
    expect(alert()).toBeNull();
    expect(emptyRegion()).toBeNull();
    expect(button('Select Multiple')).toBeUndefined();
    await act(async () => pending.resolve([]));
    expect(status()).toBeNull();
    expect(emptyRegion()).not.toBeNull();
    expect(container.querySelector('a[href="/add"]')).not.toBeNull();
    expect(container.querySelector('a[href="/browse"]')).not.toBeNull();
    expect(button('Select Multiple')).toBeUndefined();
    expect(count('/meals')).toBe(1);
});

test('Available Meals failure has a readable error and Retry makes exactly one existing meal request', async () => {
    respond = config => Promise.reject(failure(config, 'Meals unavailable'));
    await mount('meals');
    expect(alert().textContent).toContain('Meals unavailable');
    expect(emptyRegion()).toBeNull();
    expect(container.querySelector('.rustic-meal-grid')).toBeNull();
    const retry = button('Retry');
    retry.focus();
    expect(document.activeElement).toBe(retry);
    const pending = deferred();
    respond = config => pending.promise.then(data => reply(config, data));
    await click(retry);
    expect(count('/meals')).toBe(2);
    expect(status()).not.toBeNull();
    expect(alert()).toBeNull();
    expect(emptyRegion()).toBeNull();
    await act(async () => pending.resolve([meal]));
    expect(text()).toContain(meal.name);
    expect(button('Select Multiple')).toBeDefined();
    expect(count('/meals')).toBe(2);
});

test('Available Meals retains recipes and checked selection during refresh and refresh failure', async () => {
    await mount('meals');
    await click(button('Select Multiple'));
    await click(container.querySelector('input[type="checkbox"]'));
    const pending = deferred();
    respond = config => pending.promise.then(data => reply(config, data));
    await act(async () => { userData.refreshMeals().catch(() => {}); });
    expect(status()).not.toBeNull();
    expect(text()).toContain(meal.name);
    expect(container.querySelector('input[type="checkbox"]').checked).toBe(true);
    expect(emptyRegion()).toBeNull();
    await act(async () => pending.reject(failure(requests[1], 'Refresh unavailable')));
    expect(alert().textContent).toContain('Refresh unavailable');
    expect(text()).toContain(meal.name);
    expect(container.querySelector('input[type="checkbox"]').checked).toBe(true);
    expect(emptyRegion()).toBeNull();
    expect(count('/meals', 'delete')).toBe(0);
});

test('Browse loading and failed states stay distinct from empty and Retry still requests the library once', async () => {
    const pending = deferred();
    respond = config => config.url === '/meals/global'
        ? pending.promise.then(data => reply(config, data)) : defaultResponse(config);
    await mount('browse');
    expect(status().textContent).toContain('Loading recipes');
    expect(emptyRegion()).toBeNull();
    const libraryRequest = requests.find(config => config.url === '/meals/global');
    await act(async () => pending.reject(failure(libraryRequest, 'Library unavailable')));
    expect(alert().textContent).toContain('Could not load the recipe library. Please try again.');
    expect(emptyRegion()).toBeNull();
    expect(text()).not.toContain('No recipes to browse yet');
    respond = defaultResponse;
    await click(button('Retry'));
    expect(count('/meals/global')).toBe(2);
    expect(alert()).toBeNull();
    expect(emptyRegion()).not.toBeNull();
    expect(text()).toContain('No recipes to browse yet.');
});

test('Planner waits for the initial plan request before showing a genuinely empty week', async () => {
    const pending = deferred();
    respond = config => config.url === '/plan'
        ? pending.promise.then(data => reply(config, data)) : defaultResponse(config);
    await mount('planner');
    expect(status().textContent).toMatch(/Loading this week/);
    expect(emptyRegion()).toBeNull();
    expect(text()).not.toContain('No saved plan');
    expect(button('Generate New Plan').disabled).toBe(true);
    await act(async () => pending.resolve(emptyPlan));
    expect(emptyRegion()).not.toBeNull();
    expect(text()).toContain('No saved plan for this week');
    expect(button('Generate New Plan').disabled).toBe(false);
    expect(count('/plan', 'post')).toBe(0);
});

test('Planner does not claim there are no meals while the collection is still loading', async () => {
    const pending = deferred();
    respond = config => config.url === '/meals' ? pending.promise.then(data => reply(config, data))
        : Promise.resolve(reply(config, emptyPlan));
    await mount('planner');
    expect(status()).not.toBeNull();
    expect(emptyRegion()).toBeNull();
    expect(text()).not.toMatch(/No meals available|No saved plan/);
    await act(async () => pending.resolve([]));
    expect(emptyRegion()).not.toBeNull();
    expect(container.querySelector('a[href="/add"]')).not.toBeNull();
    expect(button('Generate New Plan').disabled).toBe(true);
});

test('Planner load failure suppresses empty guidance and existing Reload retries once', async () => {
    respond = config => config.url === '/plan'
        ? Promise.reject(failure(config, 'Plan unavailable')) : defaultResponse(config);
    await mount('planner');
    expect(alert().textContent).toContain('Plan unavailable');
    expect(emptyRegion()).toBeNull();
    expect(text()).not.toContain('No saved plan');
    respond = config => config.url === '/plan'
        ? Promise.resolve(reply(config, emptyPlan)) : defaultResponse(config);
    await click(button('Reload this week'));
    expect(count('/plan')).toBe(2);
    expect(count('/plan', 'post')).toBe(0);
    expect(alert()).toBeNull();
    expect(emptyRegion()).not.toBeNull();
});

test('Planner meal-load failure offers the existing collection retry destination instead of claiming no meals exist', async () => {
    respond = config => config.url === '/meals' ? Promise.reject(failure(config, 'Meals unavailable'))
        : Promise.resolve(reply(config, emptyPlan));
    await mount('planner');
    expect(alert().textContent).toContain('Meals unavailable');
    expect(emptyRegion()).toBeNull();
    expect(text()).not.toMatch(/No meals available|No saved plan/);
    expect(container.querySelector('a[href="/available-meals"]')).not.toBeNull();
    expect(button('Generate New Plan').disabled).toBe(true);
    expect(count('/meals')).toBe(1);
    expect(count('/plan')).toBe(1);
    expect(count('/plan', 'post')).toBe(0);
});

test('Planner keeps the loaded four-slot table visible during refresh and a failed reload', async () => {
    await mount('planner');
    const table = container.querySelector('table');
    const cells = table.querySelectorAll('tbody td');
    expect(cells).toHaveLength(4);
    const before = table.innerHTML;
    const pending = deferred();
    respond = config => config.url === '/plan'
        ? pending.promise.then(data => reply(config, data)) : defaultResponse(config);
    await act(async () => { userData.loadPlan(true); });
    expect(status()).not.toBeNull();
    expect(container.querySelector('table')).toBe(table);
    expect(table.innerHTML).toBe(before);
    expect(emptyRegion()).toBeNull();
    await act(async () => pending.reject(failure(requests[requests.length - 1], 'Reload unavailable')));
    expect(alert().textContent).toContain('Reload unavailable');
    expect(table.innerHTML).toBe(before);
    expect(emptyRegion()).toBeNull();
});

test.each(['/grocery', '/plan'])('Grocery waits for %s before showing an empty saved-list state', async endpoint => {
    const pending = deferred();
    respond = config => config.url === endpoint ? pending.promise.then(data => reply(config, data))
        : config.url === '/grocery' ? Promise.resolve(reply(config, [])) : defaultResponse(config);
    await mount('grocery');
    expect(status()).not.toBeNull();
    expect(emptyRegion()).toBeNull();
    expect(text()).not.toContain('No saved list');
    expect(button('Generate List from Weekly Plan')).toBeUndefined();
    await act(async () => pending.resolve(endpoint === '/grocery' ? [] : plan));
    expect(emptyRegion()).not.toBeNull();
    expect(text()).toContain('No saved list for this week');
    expect(button('Generate List from Weekly Plan').disabled).toBe(false);
    expect(count('/grocery', 'post')).toBe(0);
});

test.each(['/grocery', '/plan'])('Grocery %s failure cannot look empty; Reload invokes each existing endpoint exactly once', async endpoint => {
    respond = config => config.url === endpoint ? Promise.reject(failure(config, 'Week unavailable'))
        : config.url === '/grocery' ? Promise.resolve(reply(config, [])) : defaultResponse(config);
    await mount('grocery');
    expect(alert().textContent).toContain('Week unavailable');
    expect(emptyRegion()).toBeNull();
    expect(text()).not.toContain('No saved list');
    expect(button('Generate List from Weekly Plan')).toBeUndefined();
    respond = config => config.url === '/grocery' ? Promise.resolve(reply(config, [])) : defaultResponse(config);
    await click(button('Reload this week'));
    expect(count('/grocery')).toBe(2);
    expect(count('/plan')).toBe(2);
    expect(count('/grocery', 'post')).toBe(0);
    expect(alert()).toBeNull();
    expect(emptyRegion()).not.toBeNull();
});

test('Grocery links a successfully loaded empty plan to the existing Planner', async () => {
    respond = config => config.url === '/grocery' ? Promise.resolve(reply(config, []))
        : config.url === '/plan' ? Promise.resolve(reply(config, emptyPlan)) : defaultResponse(config);
    await mount('grocery');
    expect(emptyRegion()).not.toBeNull();
    expect(container.querySelector('a[href="/meal-planner"]')).not.toBeNull();
    expect(button('Generate List from Weekly Plan').disabled).toBe(true);
    expect(count('/grocery', 'post')).toBe(0);
});

test('Grocery search with no matches explains the filter without implying its saved list is empty', async () => {
    await mount('grocery');
    const search = container.querySelector('input[aria-label="Search ingredients"]');
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, 'unmatched ingredient');
        search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(emptyRegion()).not.toBeNull();
    expect(emptyRegion().textContent).toMatch(/match|search/i);
    expect(text()).not.toContain('No saved list');
    expect(button('Regenerate from Current Plan')).toBeDefined();
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(count('/grocery')).toBe(1);
    expect(count(`/grocery/${grocery._id}`, 'put')).toBe(0);
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, '');
        search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(emptyRegion()).toBeNull();
    expect(container.querySelector('input[type="checkbox"]').checked).toBe(false);
});

test('Grocery describes a saved list with zero ingredients separately from search matches', async () => {
    respond = config => config.url === '/grocery' ? Promise.resolve(reply(config, [{ ...grocery, items: [] }])) : defaultResponse(config);
    await mount('grocery');
    expect(emptyRegion()).not.toBeNull();
    expect(emptyRegion().textContent).toMatch(/ingredients/i);
    expect(emptyRegion().textContent).not.toMatch(/match|search/i);
    expect(text()).not.toContain('No saved list');
    expect(button('Regenerate from Current Plan')).toBeDefined();
    expect(button('CSV').disabled).toBe(true);
    expect(count('/grocery', 'post')).toBe(0);
});
