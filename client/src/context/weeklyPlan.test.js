import React, { act, useContext, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, AuthContext } from './AuthContext';
import { UserDataProvider, useUserData } from './UserDataContext';
import api from '../utils/api';
import { setSessionToken } from '../utils/session';
import { PLAN_DAYS, PLAN_SLOTS, weekForDate } from '../utils/planDate';

let container, root, data, auth, adapter, requests, records;
const firstWeek = '2026-10-12';
const secondWeek = '2026-10-19';
const meal = (slot, account = 'A') => ({ _id: `${account}-${slot}`, name: `${account} ${slot}`, image: 'unneeded-image-payload', ingredients: [{ name: 'carrot' }] });
const fullPlan = (account = 'A') => PLAN_DAYS.map(day => ({ day, ...Object.fromEntries(PLAN_SLOTS.map(slot => [slot, meal(slot, account)])) }));
const record = (weekStart, plan = [], revision = 0) => ({ weekStart, plan, revision, _id: plan.length ? 'saved-plan' : null });
const reply = (config, value) => ({ config, status: 200, data: value });
const fail = (config, status, message) => Promise.reject({ config, response: { status, data: { message } } });
const pendingReply = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};

function Probe({ automatic = false }) {
    auth = useContext(AuthContext);
    data = useUserData();
    useEffect(() => { if (automatic && auth.isAuthenticated) data.loadPlan(); }, [automatic, data.loadPlan, data.weekStart, auth.isAuthenticated]);
    return <output>{JSON.stringify(data.planRecord)}</output>;
}
const mount = async ({ strict = false, automatic = false } = {}) => act(async () => {
    const tree = <AuthProvider><UserDataProvider><Probe automatic={automatic} /></UserDataProvider></AuthProvider>;
    root.render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
});
const chooseAndLoad = async (week = firstWeek) => {
    await act(async () => data.selectWeek(week));
    await act(async () => data.loadPlan());
};
const defaultAdapter = async config => {
    requests.push(config);
    const account = config.headers.get('x-auth-token') === 'plan-account-a-fixture' ? 'A' : 'B';
    if (config.url === '/auth/user') return reply(config, { id: account });
    if (config.url === '/meals') return reply(config, PLAN_SLOTS.map(slot => meal(slot, account)));
    if (config.url !== '/plan') throw new Error('Unexpected endpoint');
    if (config.method === 'get') {
        const week = config.params.weekStart;
        return reply(config, records.get(`${account}:${week}`) || record(week));
    }
    const body = JSON.parse(config.data);
    const hydrated = body.plan.map(day => ({ day: day.day, ...Object.fromEntries(PLAN_SLOTS.map(slot => [slot, day[slot] ? meal(slot, account) : null])) }));
    const saved = record(body.weekStart, hydrated, body.revision + 1);
    records.set(`${account}:${body.weekStart}`, saved);
    return reply(config, saved);
};

beforeEach(() => {
    setSessionToken('plan-account-a-fixture');
    requests = [];
    records = new Map();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    adapter = api.defaults.adapter;
    api.defaults.adapter = defaultAdapter;
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    api.defaults.adapter = adapter;
    setSessionToken(null);
});

test.each([
    ['2026-10-18', '2026-10-12'], ['2026-10-19', '2026-10-19'],
    ['2027-01-01', '2026-12-28'], ['2026-03-08', '2026-03-02'],
    ['2026-11-01', '2026-10-26']
])('calendar date %s belongs to Monday %s, including DST and year boundaries', (input, expected) => {
    expect(weekForDate(input)).toBe(expected);
    const [year, month, day] = input.split('-').map(Number);
    expect(weekForDate(new Date(year, month - 1, day, 23, 30))).toBe(expected);
});

test.each(['2026-02-30', '2026-13-01', 'not-a-date', '2026-10-12T00:00:00Z'])('invalid or non-calendar input is rejected: %s', value => {
    expect(() => weekForDate(value)).toThrow('Choose a valid date.');
});

test('all four slots survive save and remount fetch, while requests contain compact meal IDs only', async () => {
    await mount();
    await chooseAndLoad();
    await act(async () => data.savePlan(fullPlan()));
    const saved = requests.find(config => config.method === 'post');
    expect(saved.headers.get('x-auth-token')).toBe('plan-account-a-fixture');
    expect(JSON.parse(saved.data)).toEqual({ weekStart: firstWeek, revision: 0, plan: PLAN_DAYS.map(day => ({
        day, breakfast: 'A-breakfast', lunch: 'A-lunch', dinner: 'A-dinner', snack: 'A-snack'
    })) });
    expect(saved.data).not.toContain('image');
    expect(saved.data).not.toContain('ingredients');
    expect(data.weeklyPlan).toEqual(fullPlan());
    expect(data.planRecord.notice).toBe('Plan saved.');
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount();
    expect(data.weeklyPlan).toEqual([]);
    await chooseAndLoad();
    expect(data.weeklyPlan).toEqual(fullPlan());
    expect(data.planRecord.revision).toBe(1);
});

test('changing weeks clears the prior plan and ignores an out-of-order response for the old week', async () => {
    await mount();
    const older = pendingReply();
    api.defaults.adapter = config => config.url === '/plan' && config.params.weekStart === firstWeek
        ? older.promise.then(value => reply(config, value)) : defaultAdapter(config);
    await act(async () => data.selectWeek(firstWeek));
    let loading;
    await act(async () => { loading = data.loadPlan(); });
    expect(data.planRecord.loading).toBe(true);
    records.set(`A:${secondWeek}`, record(secondWeek, fullPlan(), 4));
    await chooseAndLoad(secondWeek);
    await act(async () => { older.resolve(record(firstWeek, [{ day: 'Outdated week' }])); await loading; });
    expect(data.weekStart).toBe(secondWeek);
    expect(data.planRecord.revision).toBe(4);
    expect(data.weeklyPlan).toEqual(fullPlan());
    await act(async () => data.selectWeek(firstWeek));
    expect(data.weeklyPlan).toEqual([]);
    expect(data.planRecord.loaded).toBe(false);
});

test('a save finishing after a week switch cannot replace the newly loaded week', async () => {
    await mount();
    await chooseAndLoad();
    const deferred = pendingReply();
    api.defaults.adapter = config => config.url === '/plan' && config.method === 'post'
        ? deferred.promise.then(value => reply(config, value)) : defaultAdapter(config);
    let saving;
    await act(async () => { saving = data.savePlan(fullPlan()); });
    await chooseAndLoad(secondWeek);
    await act(async () => { deferred.resolve(record(firstWeek, fullPlan(), 1)); await saving; });
    expect(data.weekStart).toBe(secondWeek);
    expect(data.weeklyPlan).toEqual([]);
    expect(data.planRecord.notice).toBe('');
});

test('rapid saves are guarded synchronously and cannot send competing writes', async () => {
    await mount();
    await chooseAndLoad();
    const deferred = pendingReply();
    let count = 0;
    api.defaults.adapter = config => {
        count += 1;
        return deferred.promise.then(value => reply(config, value));
    };
    let saving, duplicate;
    await act(async () => { saving = data.savePlan(fullPlan()); duplicate = data.savePlan(fullPlan()).catch(error => error); });
    expect((await duplicate).message).toMatch(/finish loading or saving/);
    expect(count).toBe(1);
    expect(data.planRecord.saving).toBe(true);
    await act(async () => { deferred.resolve(record(firstWeek, fullPlan(), 1)); await saving; });
    expect(data.planRecord.saving).toBe(false);
});

test('a conflict preserves the loaded plan and prevents another write until the week is reloaded', async () => {
    records.set(`A:${firstWeek}`, record(firstWeek, fullPlan(), 2));
    await mount();
    await chooseAndLoad();
    api.defaults.adapter = config => fail(config, 409, 'Plan changed');
    await act(async () => data.savePlan([]).catch(() => {}));
    expect(data.weeklyPlan).toEqual(fullPlan());
    expect(data.planRecord.loaded).toBe(false);
    expect(data.planRecord.error).toMatch(/Reload it before saving again/);
    await expect(data.savePlan([])).rejects.toThrow(/finish loading or saving/);
    records.set(`A:${firstWeek}`, record(firstWeek, fullPlan(), 3));
    api.defaults.adapter = defaultAdapter;
    await act(async () => data.loadPlan(true));
    await act(async () => data.savePlan(fullPlan()));
    expect(JSON.parse(requests.filter(config => config.method === 'post').pop().data).revision).toBe(3);
    expect(data.planRecord.revision).toBe(4);
});

test('a failed save keeps the existing plan and exposes a failure instead of success', async () => {
    records.set(`A:${firstWeek}`, record(firstWeek, fullPlan(), 2));
    await mount();
    await chooseAndLoad();
    api.defaults.adapter = config => fail(config, 503, 'Please retry later');
    await act(async () => data.savePlan([]).catch(() => {}));
    expect(data.weeklyPlan).toEqual(fullPlan());
    expect(data.planRecord.error).toBe('Plan was not saved. Please retry later');
    expect(data.planRecord.notice).toBe('');
    expect(data.planRecord.saving).toBe(false);
});

test('a response for an unexpected week is rejected and does not expose that plan', async () => {
    await mount();
    api.defaults.adapter = config => Promise.resolve(reply(config, record(secondWeek, fullPlan())));
    await chooseAndLoad();
    expect(data.planRecord.loaded).toBe(false);
    expect(data.planRecord.error).toMatch(/different week/);
    expect(data.weeklyPlan).toEqual([]);
});

test('logout clears the plan; old account callbacks and late results cannot affect a new account', async () => {
    records.set(`A:${firstWeek}`, record(firstWeek, fullPlan(), 1));
    records.set(`B:${firstWeek}`, record(firstWeek, fullPlan('B'), 1));
    await mount();
    await chooseAndLoad();
    const oldData = data;
    const deferred = pendingReply();
    api.defaults.adapter = config => config.url === '/plan' && config.headers.get('x-auth-token') === 'plan-account-a-fixture'
        ? deferred.promise.then(value => reply(config, value)) : defaultAdapter(config);
    let loading;
    await act(async () => { loading = data.loadPlan(true); });
    await act(async () => auth.logout());
    expect(data.weeklyPlan).toEqual([]);
    expect(container.textContent).not.toContain('A snack');
    await act(async () => setSessionToken('plan-account-b-fixture'));
    await chooseAndLoad();
    await act(async () => { deferred.resolve(record(firstWeek, fullPlan(), 7)); await loading; });
    expect(data.weeklyPlan).toEqual(fullPlan('B'));
    expect(() => oldData.setWeeklyPlan(fullPlan())).toThrow(/active session changed/);
    await expect(oldData.savePlan(fullPlan())).rejects.toThrow(/active session changed/);
    expect(data.weeklyPlan).toEqual(fullPlan('B'));
    expect(container.textContent).not.toContain('A snack');
});

test('StrictMode effect replay still completes the initial plan load', async () => {
    const week = weekForDate();
    records.set(`A:${week}`, record(week, fullPlan(), 1));
    await mount({ strict: true, automatic: true });
    expect(data.planRecord.loaded).toBe(true);
    expect(data.planRecord.loading).toBe(false);
    expect(data.weeklyPlan).toEqual(fullPlan());
});
