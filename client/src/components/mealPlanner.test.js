import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { UserDataProvider } from '../context/UserDataContext';
import { setSessionToken } from '../utils/session';
import { PLAN_DAYS, PLAN_SLOTS } from '../utils/planDate';
import api from '../utils/api';
import MealPlanner from './MealPlanner';

jest.mock('react-router/dom', () => jest.requireActual('react-router/dist/development/dom-export.js'), { virtual: true });
jest.mock('react-router-dom', () => jest.requireActual('react-router-dom/dist/index.js'), { virtual: true });
jest.mock('jspdf', () => jest.fn());
jest.mock('jspdf-autotable', () => jest.fn());

let root, container, adapter, respond, requests;
const meals = PLAN_SLOTS.map(slot => ({ _id: `fixture-${slot}`, category: slot[0].toUpperCase() + slot.slice(1), name: `Saved ${slot}` }));
const savedPlan = PLAN_DAYS.map(day => ({ day, ...Object.fromEntries(PLAN_SLOTS.map((slot, index) => [slot, meals[index]])) }));
const reply = (config, data) => ({ config, status: 200, data });
const fail = (config, status, message) => Promise.reject({ config, response: { status, data: { message } } });
const button = text => [...container.querySelectorAll('button')].find(item => item.textContent.includes(text));
const click = async element => act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const saves = () => requests.filter(config => config.url === '/plan' && config.method === 'post');
const dialog = () => container.querySelector('[role="dialog"]');
const chooseWeek = async value => act(async () => {
    const input = container.querySelector('#plan-week');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
});
const openReplacement = async () => {
    const trigger = button('Generate New Plan');
    trigger.focus();
    await click(trigger);
    return trigger;
};
const key = async (name, shiftKey = false) => act(async () => {
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true }));
});
const loadSaved = config => Promise.resolve(reply(config, { weekStart: config.params.weekStart, revision: 2, plan: savedPlan }));
const mount = async () => act(async () => root.render(
    <AuthContext.Provider value={{ isAuthenticated: true, sessionId: 'planner-component-fixture' }}>
        <MemoryRouter><UserDataProvider><MealPlanner meals={meals} /></UserDataProvider></MemoryRouter>
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
    expect(dialog()).toBeNull();
    expect(saves()).toHaveLength(1);
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
    expect(saves()).toHaveLength(0);
    await click(button('Confirm replacement'));
    expect(container.querySelector('[role="alert"] .page-state-detail').textContent).toBe('Plan was not saved. Service unavailable');
    expect(container.textContent).toContain('Saved snack');
    expect(container.textContent).not.toContain('Plan saved.');
    expect(button('Reload this week')).toBeDefined();
    expect(button('Generate New Plan').disabled).toBe(false);
});

test('saved-week generation explains replacement with the selected week and waits without modifying it', async () => {
    respond = loadSaved;
    await mount();
    await chooseWeek('2026-10-12');
    const before = container.querySelector('tbody').innerHTML;
    const requestCount = requests.length;
    await openReplacement();
    const modal = dialog();
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(modal.getAttribute('aria-labelledby')).textContent).toBe('Replace saved meal plan?');
    expect(document.getElementById(modal.getAttribute('aria-describedby')).textContent).toContain('replace the saved plan for the week beginning Monday, 2026-10-12');
    expect(button('Cancel').classList.contains('btn-outline-secondary')).toBe(true);
    expect(button('Confirm replacement').classList.contains('btn-danger')).toBe(true);
    expect(button('Confirm replacement').classList.contains('btn-success')).toBe(false);
    expect(document.activeElement).toBe(button('Cancel'));
    expect(saves()).toHaveLength(0);
    expect(requests).toHaveLength(requestCount);
    expect(container.querySelector('#plan-week').value).toBe('2026-10-12');
    expect(container.querySelector('tbody').innerHTML).toBe(before);
});

test('Cancel restores the Generate trigger without requests or changing the selected week or plan', async () => {
    respond = loadSaved;
    await mount();
    await chooseWeek('2026-10-12');
    const before = container.querySelector('tbody').innerHTML;
    const requestCount = requests.length;
    const trigger = await openReplacement();
    await click(button('Cancel'));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(requests).toHaveLength(requestCount);
    expect(saves()).toHaveLength(0);
    expect(container.querySelector('#plan-week').value).toBe('2026-10-12');
    expect(container.querySelector('tbody').innerHTML).toBe(before);
});

test('confirmation traps Tab in both directions and Escape cancels without saving', async () => {
    respond = loadSaved;
    await mount();
    const trigger = await openReplacement();
    const cancel = button('Cancel'), confirm = button('Confirm replacement');
    expect(document.activeElement).toBe(cancel);
    await key('Tab', true);
    expect(document.activeElement).toBe(confirm);
    await key('Tab');
    expect(document.activeElement).toBe(cancel);
    await key('Escape');
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(saves()).toHaveLength(0);
    expect(container.textContent).toContain('Saved snack');
});

test('Confirm saves once through the existing flow with the selected week and unchanged four-slot payload', async () => {
    respond = loadSaved;
    await mount();
    await chooseWeek('2026-10-12');
    let finishSave;
    respond = config => new Promise(resolve => { finishSave = () => resolve(reply(config, {
        weekStart: JSON.parse(config.data).weekStart, revision: 3, plan: savedPlan
    })); });
    const trigger = await openReplacement();
    const confirm = button('Confirm replacement');
    // Two activations in one task must still generate/save only once.
    await act(async () => { confirm.click(); confirm.click(); });
    expect(saves()).toHaveLength(1);
    expect(JSON.parse(saves()[0].data)).toEqual({ weekStart: '2026-10-12', revision: 2,
        plan: PLAN_DAYS.map(day => ({ day, breakfast: 'fixture-breakfast', lunch: 'fixture-lunch', dinner: 'fixture-dinner', snack: 'fixture-snack' })) });
    expect(dialog().textContent).toContain('Replacing the saved plan...');
    expect(button('Cancel').disabled).toBe(true);
    expect(button('Replacing...').disabled).toBe(true);
    expect(button('Replacing...').classList.contains('btn-danger')).toBe(true);
    await key('Escape');
    expect(dialog()).not.toBeNull();
    expect(saves()).toHaveLength(1);
    await act(async () => finishSave());
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.disabled).toBe(false);
    expect(container.querySelector('#plan-week').value).toBe('2026-10-12');
    expect(container.textContent).toContain('Plan saved.');
    expect(container.textContent).toContain('Saved snack');
});

test('a failed confirmed replacement keeps the saved plan, displays the existing error and restores focus', async () => {
    respond = loadSaved;
    await mount();
    const before = container.querySelector('tbody').innerHTML;
    const trigger = await openReplacement();
    respond = config => fail(config, 503, 'Service unavailable');
    await click(button('Confirm replacement'));
    expect(dialog()).toBeNull();
    expect(saves()).toHaveLength(1);
    expect(document.activeElement).toBe(trigger);
    expect(container.querySelector('tbody').innerHTML).toBe(before);
    expect(container.querySelector('[role="alert"] .page-state-detail').textContent).toBe('Plan was not saved. Service unavailable');
});

test('a confirmed save conflict returns focus to the existing Reload action when Generate is unavailable', async () => {
    respond = loadSaved;
    await mount();
    const before = container.querySelector('tbody').innerHTML;
    await openReplacement();
    respond = config => fail(config, 409, 'Plan changed');
    await click(button('Confirm replacement'));
    expect(dialog()).toBeNull();
    expect(saves()).toHaveLength(1);
    expect(button('Generate New Plan').disabled).toBe(true);
    expect(document.activeElement).toBe(button('Reload this week'));
    expect(container.querySelector('tbody').innerHTML).toBe(before);
    expect(container.querySelector('[role="alert"]').textContent).toMatch(/Reload it before saving again/);
});

test('changing weeks dismisses stale confirmation without saving and the new empty week still generates directly', async () => {
    respond = loadSaved;
    await mount();
    await chooseWeek('2026-10-12');
    await openReplacement();
    respond = config => Promise.resolve(reply(config, { weekStart: config.params.weekStart, revision: 0, plan: [] }));
    await chooseWeek('2026-10-19');
    expect(dialog()).toBeNull();
    expect(saves()).toHaveLength(0);
    expect(container.querySelector('#plan-week').value).toBe('2026-10-19');
    respond = config => Promise.resolve(reply(config, { weekStart: JSON.parse(config.data).weekStart, revision: 1, plan: savedPlan }));
    await click(button('Generate New Plan'));
    expect(dialog()).toBeNull();
    expect(saves()).toHaveLength(1);
    expect(JSON.parse(saves()[0].data).weekStart).toBe('2026-10-19');
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

test('the single responsive table keeps every meal associated with its day and slot', async () => {
    respond = config => Promise.resolve(reply(config, { weekStart: config.params.weekStart, revision: 2, plan: savedPlan }));
    await mount();
    const table = container.querySelector('table');
    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(document.getElementById(table.getAttribute('aria-labelledby')).textContent).toContain('Weekly Meal Plan');
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(7);
    rows.forEach((row, index) => {
        const dayHeader = row.querySelector('th[scope="row"]');
        expect(dayHeader.textContent).toContain(PLAN_DAYS[index]);
        const cells = row.querySelectorAll('td');
        expect(cells).toHaveLength(4);
        cells.forEach(cell => {
            const [dayId, slotId] = cell.getAttribute('headers').split(' ');
            expect(document.getElementById(dayId)).toBe(dayHeader);
            const slot = document.getElementById(slotId).textContent.toLowerCase();
            expect(PLAN_SLOTS).toContain(slot);
            expect(cell.textContent).toContain(`Saved ${slot}`);
        });
    });
});

test('generation stays with the selected week before the plan, while exports are secondary utilities', async () => {
    respond = loadSaved;
    await mount();
    const controls = container.querySelector('[role="group"][aria-label="Plan this week"]');
    const generate = button('Generate New Plan');
    expect(controls.contains(container.querySelector('#plan-week'))).toBe(true);
    expect(controls.contains(generate)).toBe(true);
    expect(generate.classList.contains('btn-success')).toBe(true);
    expect([...container.querySelectorAll('button')].filter(item => item.textContent.includes('Generate New Plan'))).toHaveLength(1);
    expect(generate.compareDocumentPosition(container.querySelector('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const exports = container.querySelector('[role="group"][aria-labelledby="planner-export-heading"]');
    expect(document.getElementById(exports.getAttribute('aria-labelledby')).textContent).toContain('Share Meal Plan');
    ['Export CSV', 'Export PDF', 'Share on WhatsApp'].forEach(label => {
        const action = button(label);
        expect(exports.contains(action)).toBe(true);
        expect(action.classList.contains('btn-outline-secondary')).toBe(true);
        expect(action.classList.contains('btn-danger')).toBe(false);
        expect(action.classList.contains('btn-outline-danger')).toBe(false);
    });
});
