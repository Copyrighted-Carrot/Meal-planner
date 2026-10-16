import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContext } from '../context/AuthContext';
import { UserDataProvider } from '../context/UserDataContext';
import { setSessionToken } from '../utils/session';
import { PLAN_DAYS, PLAN_SLOTS } from '../utils/planDate';
import api from '../utils/api';
import MealPlanner from './MealPlanner';

jest.mock('jspdf', () => jest.fn());
jest.mock('jspdf-autotable', () => jest.fn());

let root, container, adapter, respond, requests;
const meals = PLAN_SLOTS.map(slot => ({ _id: `fixture-${slot}`, category: slot[0].toUpperCase() + slot.slice(1), name: `Saved ${slot}` }));
const savedPlan = PLAN_DAYS.map(day => ({ day, ...Object.fromEntries(PLAN_SLOTS.map((slot, index) => [slot, meals[index]])) }));
const reply = (config, data) => ({ config, status: 200, data });
const fail = (config, status, message) => Promise.reject({ config, response: { status, data: { message } } });
const button = text => [...container.querySelectorAll('button')].find(item => item.textContent.includes(text));
const click = async element => act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const mount = async () => act(async () => root.render(
    <AuthContext.Provider value={{ isAuthenticated: true, sessionId: 'planner-component-fixture' }}>
        <UserDataProvider><MealPlanner meals={meals} /></UserDataProvider>
    </AuthContext.Provider>
));

beforeEach(() => {
    setSessionToken('planner-component-fixture');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    adapter = api.defaults.adapter;
    requests = [];
    respond = config => Promise.resolve(reply(config, { weekStart: config.params.weekStart, revision: 0, plan: [] }));
    api.defaults.adapter = config => {
        requests.push(config);
        return config.url === '/meals' ? Promise.resolve(reply(config, meals)) : respond(config);
    };
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    api.defaults.adapter = adapter;
    setSessionToken(null);
});

test('loading and saving disable generation, then successful save visibly displays snacks and confirmation', async () => {
    let finishLoad;
    respond = config => new Promise(resolve => { finishLoad = () => resolve(reply(config, { weekStart: config.params.weekStart, revision: 0, plan: [] })); });
    await mount();
    expect(container.querySelector('[role="status"]').textContent).toMatch(/Loading this week/);
    expect(button('Generate New Plan').disabled).toBe(true);
    await act(async () => finishLoad());
    expect(button('Generate New Plan').disabled).toBe(false);
    let finishSave;
    respond = config => new Promise(resolve => { finishSave = () => resolve(reply(config, {
        weekStart: JSON.parse(config.data).weekStart, revision: 1, plan: savedPlan
    })); });
    await click(button('Generate New Plan'));
    expect(container.querySelector('[role="status"]').textContent).toMatch(/Saving this week/);
    expect(button('Generate New Plan').disabled).toBe(true);
    await act(async () => finishSave());
    expect(container.querySelector('[role="status"]').textContent).toBe('Plan saved.');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(7);
    expect(container.textContent).toContain('Saved snack');
    expect(button('Generate New Plan').disabled).toBe(false);
    const posted = JSON.parse(requests.find(config => config.method === 'post').data);
    expect(posted.plan.every(day => day.snack === 'fixture-snack')).toBe(true);
});

test('failed saves show an alert and preserve the previously loaded plan', async () => {
    respond = config => Promise.resolve(reply(config, { weekStart: config.params.weekStart, revision: 2, plan: savedPlan }));
    await mount();
    respond = config => fail(config, 503, 'Service unavailable');
    await click(button('Generate New Plan'));
    expect(container.querySelector('[role="alert"]').textContent).toBe('Plan was not saved. Service unavailable');
    expect(container.textContent).toContain('Saved snack');
    expect(container.textContent).not.toContain('Plan saved.');
    expect(button('Reload this week')).toBeDefined();
    expect(button('Generate New Plan').disabled).toBe(false);
});

test('a conflicting save requires visible reload before generation can resume', async () => {
    await mount();
    respond = config => fail(config, 409, 'Plan changed');
    await click(button('Generate New Plan'));
    expect(container.querySelector('[role="alert"]').textContent).toMatch(/Reload it before saving again/);
    expect(button('Generate New Plan').disabled).toBe(true);
    respond = config => Promise.resolve(reply(config, { weekStart: config.params.weekStart, revision: 3, plan: savedPlan }));
    await click(button('Reload this week'));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain('Saved snack');
    expect(button('Generate New Plan').disabled).toBe(false);
});
