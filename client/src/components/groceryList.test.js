import React, { act, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, AuthContext } from '../context/AuthContext';
import { UserDataProvider, useUserData } from '../context/UserDataContext';
import { setSessionToken } from '../utils/session';
import { weekForDate } from '../utils/planDate';
import { groceryCSV, groceryPDFTable, groceryText } from '../utils/groceryExport';
import api from '../utils/api';
import GroceryList from './GroceryList';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

jest.mock('react-router/dom', () => jest.requireActual('react-router/dist/development/dom-export.js'), { virtual: true });
jest.mock('react-router-dom', () => jest.requireActual('react-router-dom/dist/index.js'), { virtual: true });
jest.mock('jspdf', () => ({ jsPDF: jest.fn() }));
jest.mock('jspdf-autotable', () => jest.fn());

let container, root, data, auth, adapter, requests, lists, legacy, respond, pdf, blob;
let createObjectURL, revokeObjectURL;
const currentWeek = weekForDate();
const nextWeek = '2030-01-07';
const clone = value => JSON.parse(JSON.stringify(value));
const reply = (config, value) => ({ config, status: 200, data: clone(value) });
const fail = (config, status, message) => Promise.reject({ config, response: { status, data: { message } } });
const fixtureItems = (account = 'A') => ['Apples', 'Broccoli', 'Carrots', 'Dates', 'Eggs', 'Flour'].map((name, index) => ({
    _id: `${account}-item-${index}`, key: `${name.toLowerCase()}|mass`, name: `${account} ${name}`, amount: index === 4 ? 'Quantity unknown' : `${index + 1} kg`, checked: index === 5,
}));
const fixtureList = (account = 'A', week = currentWeek, revision = 2) => ({
    _id: `${account}-list-${week}`, weekStart: week, revision, sourcePlanRevision: 3,
    createdAt: '2026-10-12T12:00:00Z', items: fixtureItems(account),
});
const fixturePlan = (account, week) => ({ _id: `${account}-plan-${week}`, weekStart: week, revision: 3,
    plan: [{ day: 'Monday', breakfast: null, lunch: null, dinner: null, snack: { _id: `${account}-snack`, name: `${account} snack` } }],
});
const button = text => [...container.querySelectorAll('button')].find(element => element.textContent.includes(text));
const checkbox = name => [...container.querySelectorAll('input[type="checkbox"]')].find(element => element.getAttribute('aria-label').includes(name));
const click = async element => act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const input = async (element, value) => act(async () => {
    const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
});
const search = value => input(container.querySelector('input[placeholder="Search ingredients..."]'), value);

function Probe() {
    auth = useContext(AuthContext);
    data = useUserData();
    return auth.isAuthenticated ? <GroceryList /> : null;
}
const mount = async (strict = false) => act(async () => {
    const tree = <MemoryRouter><AuthProvider><UserDataProvider><Probe /></UserDataProvider></AuthProvider></MemoryRouter>;
    root.render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
});
const defaultResponse = async config => {
    const account = config.headers.get('x-auth-token') === 'grocery-account-a-fixture' ? 'A' : 'B';
    if (config.url === '/auth/user') return reply(config, { id: account });
    if (config.url === '/meals') return reply(config, []);
    if (config.url === '/plan') return reply(config, fixturePlan(account, config.params.weekStart));
    if (config.url === '/grocery' && config.method === 'get') {
        const stored = lists.get(`${account}:${config.params.weekStart}`);
        return reply(config, [...(stored ? [stored] : []), ...(legacy.get(account) || [])]);
    }
    if (config.url === '/grocery' && config.method === 'post') {
        const body = JSON.parse(config.data);
        const saved = fixtureList(account, body.weekStart, body.revision + 1);
        lists.set(`${account}:${body.weekStart}`, saved);
        return reply(config, saved);
    }
    const stored = [...lists.values(), ...(legacy.get(account) || [])].find(list => config.url === `/grocery/${list._id}`);
    if (!stored) throw new Error('Unexpected test endpoint');
    if (config.method === 'put') {
        const body = JSON.parse(config.data);
        stored.items = stored.items.map(item => item._id === body.itemId ? { ...item, checked: body.checked } : item);
        stored.revision += 1;
        return reply(config, stored);
    }
    if (config.method === 'delete') {
        if (stored.weekStart) lists.delete(`${account}:${stored.weekStart}`);
        else legacy.set(account, legacy.get(account).filter(list => list._id !== stored._id));
        return reply(config, { message: 'Deleted' });
    }
    throw new Error('Unexpected test operation');
};

beforeEach(() => {
    sessionStorage.clear();
    setSessionToken('grocery-account-a-fixture');
    requests = [];
    lists = new Map([[`A:${currentWeek}`, fixtureList()], [`B:${currentWeek}`, fixtureList('B')]]);
    legacy = new Map();
    respond = defaultResponse;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    adapter = api.defaults.adapter;
    api.defaults.adapter = config => { requests.push(config); return respond(config); };
    createObjectURL = URL.createObjectURL;
    revokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(value => { blob = value; return 'blob:grocery-export-fixture'; });
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    jest.spyOn(window, 'open').mockImplementation(() => null);
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    pdf = { setFontSize: jest.fn(), text: jest.fn(), save: jest.fn() };
    jsPDF.mockImplementation(() => pdf);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    api.defaults.adapter = adapter;
    setSessionToken(null);
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    jest.restoreAllMocks();
    jest.clearAllMocks();
    sessionStorage.clear();
});

test('direct Grocery load fetches its week and plan; generation sends only authoritative plan references', async () => {
    lists.delete(`A:${currentWeek}`);
    await mount();
    expect(requests.filter(config => config.url === '/plan' || config.url === '/grocery').every(config => config.params.weekStart === currentWeek)).toBe(true);
    expect(requests.some(config => config.url === '/plan')).toBe(true);
    expect(button('Generate List from Weekly Plan').disabled).toBe(false);
    await click(button('Generate List from Weekly Plan'));
    const posted = requests.find(config => config.method === 'post');
    expect(posted.headers.get('x-auth-token')).toBe('grocery-account-a-fixture');
    expect(JSON.parse(posted.data)).toEqual({ weekStart: currentWeek, sourcePlanId: `A-plan-${currentWeek}`, sourcePlanRevision: 3, revision: 0 });
    expect(container.textContent).toContain('A Carrots: 3 kg');
});

test('a filtered checkbox updates its stable item ID and survives clearing search and remounting', async () => {
    await mount();
    await search('Carrots');
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
    await click(checkbox('Carrots'));
    const updated = requests.find(config => config.method === 'put');
    expect(JSON.parse(updated.data)).toEqual({ itemId: 'A-item-2', checked: true, revision: 2 });
    await search('');
    expect(checkbox('Carrots').checked).toBe(true);
    expect(checkbox('Apples').checked).toBe(false);
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount();
    expect(checkbox('Carrots').checked).toBe(true);
    expect(checkbox('Apples').checked).toBe(false);
});

test('rapid duplicate clicks send one write and keep the checkbox unchanged until confirmation', async () => {
    await mount();
    let finish;
    respond = config => config.method === 'put' ? new Promise(resolve => { finish = () => defaultResponse(config).then(resolve); }) : defaultResponse(config);
    const row = checkbox('Carrots').closest('li');
    await act(async () => {
        row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(requests.filter(config => config.method === 'put')).toHaveLength(1);
    expect(checkbox('Carrots').checked).toBe(false);
    expect(checkbox('Carrots').disabled).toBe(true);
    await act(async () => finish());
    expect(checkbox('Carrots').checked).toBe(true);
    expect(checkbox('Carrots').disabled).toBe(false);
});

test.each([409, 503])('failed checkbox save (%s) preserves checks and requires reload before another mutation', async status => {
    await mount();
    respond = config => config.method === 'put' ? fail(config, status, 'Could not save') : defaultResponse(config);
    await click(checkbox('Carrots'));
    expect(checkbox('Carrots').checked).toBe(false);
    expect(checkbox('Carrots').disabled).toBe(true);
    expect(container.querySelector('[role="alert"]').textContent).toMatch(/Reload/);
    await click(checkbox('Apples').closest('li'));
    expect(requests.filter(config => config.method === 'put')).toHaveLength(1);
    respond = defaultResponse;
    await click(button('Reload this week'));
    expect(checkbox('Carrots').disabled).toBe(false);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await click(checkbox('Carrots'));
    expect(checkbox('Carrots').checked).toBe(true);
});

test('load failure is visible and retry loads the saved list instead of presenting a false empty result', async () => {
    respond = config => config.url === '/grocery' ? fail(config, 503, 'Groceries unavailable') : defaultResponse(config);
    await mount();
    expect(container.querySelector('[role="alert"] .page-state-detail').textContent).toBe('Groceries unavailable');
    expect(container.textContent).not.toContain('No saved list for this week');
    expect(button('Generate List from Weekly Plan')).toBeUndefined();
    respond = defaultResponse;
    await click(button('Reload this week'));
    expect(container.textContent).toContain('A Carrots: 3 kg');
    expect(container.querySelector('[role="alert"]')).toBeNull();
});

test('a late list load from the former week cannot replace the selected week', async () => {
    let finish;
    respond = config => config.url === '/grocery' && config.params.weekStart === currentWeek
        ? new Promise(resolve => { finish = () => resolve(reply(config, [fixtureList()])); }) : defaultResponse(config);
    await mount();
    await act(async () => data.selectWeek(nextWeek));
    expect(container.textContent).not.toContain('A Carrots');
    expect(container.textContent).toContain('No saved list for this week');
    await act(async () => finish());
    expect(container.querySelector('#grocery-week').value).toBe(nextWeek);
    expect(container.textContent).not.toContain('A Carrots');
    expect(button('Generate List from Weekly Plan').disabled).toBe(false);
});

test('a late checkbox write from the former week cannot replace the new week or its loading state', async () => {
    await mount();
    let finish;
    respond = config => config.method === 'put' ? new Promise(resolve => { finish = () => defaultResponse(config).then(resolve); }) : defaultResponse(config);
    await click(checkbox('Carrots'));
    await act(async () => data.selectWeek(nextWeek));
    await act(async () => finish());
    expect(container.querySelector('#grocery-week').value).toBe(nextWeek);
    expect(container.textContent).not.toContain('A Carrots');
    expect(button('Generate List from Weekly Plan').disabled).toBe(false);
});

test('logout clears groceries and a late A response cannot replace account B data', async () => {
    await mount();
    let finish;
    respond = config => config.method === 'put' ? new Promise(resolve => { finish = () => defaultResponse(config).then(resolve); }) : defaultResponse(config);
    await click(checkbox('Carrots'));
    await act(async () => auth.logout());
    expect(container.textContent).not.toContain('A Carrots');
    await act(async () => setSessionToken('grocery-account-b-fixture'));
    await act(async () => finish());
    expect(container.textContent).toContain('B Carrots');
    expect(container.textContent).not.toContain('A Carrots');
    expect(checkbox('Carrots').checked).toBe(false);
});

test.each([true, false])('regenerating while viewing a legacy list uses the dated list revision (dated=%s)', async hasDated => {
    const old = { ...fixtureList(), _id: 'older-list', weekStart: null, revision: 19, items: [{ _id: 'old-item', name: 'Older lentils', amount: '2 kg', checked: true }] };
    legacy.set('A', [old]);
    if (!hasDated) lists.delete(`A:${currentWeek}`);
    await mount();
    expect(container.textContent).not.toContain('Older lentils');
    await input(container.querySelector('#legacy-grocery'), 'older-list');
    expect(container.textContent).toContain('Older lentils');
    await click(button('Regenerate from Current Plan'));
    const posted = JSON.parse(requests.find(config => config.method === 'post').data);
    expect(posted.revision).toBe(hasDated ? 2 : 0);
    expect(posted.weekStart).toBe(currentWeek);
    expect(container.querySelector('#legacy-grocery').value).toBe('');
    expect(container.textContent).toContain('A Carrots');
    expect(legacy.get('A')[0]).toEqual(old);
});

test('delete targets the displayed list and revision and clears it only after confirmation', async () => {
    await mount();
    await click(button('Delete List'));
    const deleted = requests.find(config => config.method === 'delete');
    expect(deleted.url).toBe(`/grocery/A-list-${currentWeek}`);
    expect(deleted.params).toEqual({ revision: 2 });
    expect(container.textContent).not.toContain('A Carrots');
    expect(container.textContent).toContain('No saved list for this week');
});

test('CSV, PDF and share export every confirmed item despite search and the five-row display limit', async () => {
    await mount();
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(5);
    await search('Carrots');
    const items = lists.get(`A:${currentWeek}`).items;
    await click(button('CSV'));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const content = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(blob);
    });
    expect(String(content).replace(/^\uFEFF/, '')).toBe(groceryCSV(items));
    await click(button('PDF'));
    expect(autoTable).toHaveBeenCalledWith(pdf, groceryPDFTable(items));
    expect(pdf.save).toHaveBeenCalledWith('grocery_list.pdf');
    await click(button('WhatsApp'));
    const [url, target, features] = window.open.mock.calls[0];
    expect(new URL(url).searchParams.get('text')).toBe(`*My Grocery List*\n\n${groceryText(items)}`);
    expect(target).toBe('_blank');
    expect(features).toBe('noopener,noreferrer');
    expect(items).toHaveLength(6);
    expect(groceryText(items)).toContain('[x] A Flour: 6 kg');
    expect(groceryText(items)).toContain('Quantity unknown');
});

test('changing the displayed legacy list cancels a pending PDF export of the previous list', async () => {
    const old = { ...fixtureList(), _id: 'older-list', weekStart: null,
        items: [{ _id: 'old-item', name: 'Older lentils', amount: '2 kg', checked: true }] };
    legacy.set('A', [old]);
    await mount();
    await act(async () => {
        button('PDF').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const selector = container.querySelector('#legacy-grocery');
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(selector, 'older-list');
        selector.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('Older lentils');
    expect(pdf.save).not.toHaveBeenCalled();
    expect(autoTable).not.toHaveBeenCalled();
    await click(button('PDF'));
    expect(autoTable).toHaveBeenCalledWith(pdf, groceryPDFTable(old.items));
    expect(pdf.save).toHaveBeenCalledWith('grocery_list.pdf');
});

test('StrictMode effect replay still completes grocery loading', async () => {
    await mount(true);
    expect(container.textContent).toContain('A Carrots');
    expect(checkbox('Carrots').disabled).toBe(false);
});
