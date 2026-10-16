import React, { act, useContext, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, AuthContext } from './AuthContext';
import { UserDataProvider, useUserData } from './UserDataContext';
import api from '../utils/api';
import { captureSession, setSessionToken } from '../utils/session';

let container, root, auth, data, setLocal, adapter, requests;
const reply = (config, value) => ({ config, status: 200, data: value });
const reject401 = config => Promise.reject({ config, response: { status: 401, data: { message: 'Session expired' } } });
function Probe() {
    auth = useContext(AuthContext);
    data = useUserData();
    const [local, updateLocal] = useState('');
    setLocal = updateLocal;
    return <output>{JSON.stringify({ user: auth.user?.id, authenticated: auth.isAuthenticated, meals: data.meals, plan: data.weeklyPlan, draft: data.draftMeal, starter: data.showStarterModal, smart: data.showSmartModal, local })}</output>;
}
const mount = async () => act(async () => root.render(<AuthProvider><UserDataProvider><Probe /></UserDataProvider></AuthProvider>));
const signIn = async account => act(async () => auth.login({ email: `${account}@example.invalid`, password: ['isolated', 'test', 'input'].join('-') }));
const defaultAdapter = async config => {
    requests.push(config);
    if (config.url === '/auth/login') return reply(config, { token: JSON.parse(config.data).email.startsWith('a@') ? 'session-a-fixture' : 'session-b-fixture' });
    const account = config.headers.get('x-auth-token') === 'session-a-fixture' ? 'A' : 'B';
    if (config.url === '/auth/user') return reply(config, { id: account, name: account });
    if (config.url === '/meals') return reply(config, [{ _id: account + '-meal', name: account + ' meal' }]);
    throw new Error('Unexpected test endpoint');
};
beforeEach(() => {
    setSessionToken(null);
    requests = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    adapter = api.defaults.adapter;
    api.defaults.adapter = defaultAdapter;
    jest.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    api.defaults.adapter = adapter;
    setSessionToken(null);
    jest.restoreAllMocks();
});

test('A login loads A meals; logout clears shared and page-local data; B starts with only B data', async () => {
    await mount();
    expect(requests).toHaveLength(0);
    await signIn('a');
    expect(auth.user.id).toBe('A');
    expect(data.meals.map(meal => meal.name)).toEqual(['A meal']);
    await act(async () => {
        data.setWeeklyPlan([{ day: 'Monday', breakfast: data.meals[0] }]);
        data.setDraftMeal({ name: 'Private A draft', ingredients: 'Private A ingredients', image: null, previewUrl: null });
        data.setShowStarterModal(true);
        data.setShowSmartModal(true);
        setLocal('Private A grocery/gallery selection');
    });
    expect(container.textContent).toContain('Private A');
    await act(async () => auth.logout());
    expect(auth.isAuthenticated).toBe(false);
    expect(data.meals).toEqual([]);
    expect(data.weeklyPlan).toEqual([]);
    expect(data.draftMeal.name).toBe('');
    expect(container.textContent).not.toContain('Private A');
    expect(data.showSmartModal).toBe(false);
    expect(data.showStarterModal).toBe(false);
    await signIn('b');
    expect(auth.user.id).toBe('B');
    expect(data.meals.map(meal => meal.name)).toEqual(['B meal']);
    expect(container.textContent).not.toContain('A meal');
    expect(container.textContent).not.toContain('Private A');
});

test('same-session rerenders preserve the draft and plan instead of refetching user data', async () => {
    await mount();
    await signIn('a');
    await act(async () => { data.setDraftMeal({ name: 'Saved draft' }); data.setWeeklyPlan([{ day: 'Monday' }]); });
    const fetched = requests.filter(config => config.url === '/meals').length;
    await mount();
    expect(data.draftMeal.name).toBe('Saved draft');
    expect(data.weeklyPlan).toHaveLength(1);
    expect(requests.filter(config => config.url === '/meals')).toHaveLength(fetched);
});

test('a late A meal response cannot repopulate B state after switching accounts', async () => {
    let finish;
    api.defaults.adapter = config => config.url === '/meals' && config.headers.get('x-auth-token') === 'session-a-fixture'
        ? new Promise(resolve => { finish = () => resolve(reply(config, [{ name: 'Late A meal' }])); })
        : defaultAdapter(config);
    await mount();
    await signIn('a');
    expect(finish).toBeDefined();
    await signIn('b');
    await act(async () => finish());
    expect(auth.user.id).toBe('B');
    expect(data.meals.map(meal => meal.name)).toEqual(['B meal']);
});

test('a late stored-session account lookup cannot replace a newer login', async () => {
    let finish;
    setSessionToken('session-a-fixture');
    api.defaults.adapter = config => config.url === '/auth/user' && config.headers.get('x-auth-token') === 'session-a-fixture'
        ? new Promise(resolve => { finish = () => resolve(reply(config, { id: 'A' })); })
        : defaultAdapter(config);
    await mount();
    await signIn('b');
    await act(async () => finish());
    expect(auth.user.id).toBe('B');
    expect(data.meals.map(meal => meal.name)).toEqual(['B meal']);
});

test('logout while sign-in is pending prevents the late result restoring authentication', async () => {
    let finish, pending;
    api.defaults.adapter = config => new Promise(resolve => { finish = () => resolve(reply(config, { token: 'session-a-fixture' })); });
    await mount();
    await act(async () => { pending = auth.login({ email: 'a@example.invalid' }).catch(error => error); });
    await act(async () => auth.logout());
    await act(async () => finish());
    expect(await pending).toMatchObject({ code: 'SESSION_CHANGED' });
    expect(auth.isAuthenticated).toBe(false);
    expect(captureSession().token).toBeNull();
});

test('a current protected 401 clears authentication, meals, plan, draft and local state', async () => {
    await mount();
    await signIn('a');
    await act(async () => { data.setWeeklyPlan([{ day: 'A plan' }]); data.setDraftMeal({ name: 'A draft' }); setLocal('A local'); });
    api.defaults.adapter = reject401;
    await act(async () => data.refreshMeals().catch(() => {}));
    expect(auth.isAuthenticated).toBe(false);
    expect(captureSession().token).toBeNull();
    expect(data.meals).toEqual([]);
    expect(data.weeklyPlan).toEqual([]);
    expect(data.draftMeal.name).toBe('');
    expect(container.textContent).not.toContain('A local');
});

test('an invalid stored token never reveals a protected user or loads meals', async () => {
    setSessionToken('expired-fixture');
    api.defaults.adapter = jest.fn(reject401);
    await mount();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.loading).toBe(false);
    expect(data.meals).toEqual([]);
    expect(api.defaults.adapter.mock.calls.every(([config]) => config.url === '/auth/user')).toBe(true);
});

test('another tab switching the stored account reloads private state for the new account', async () => {
    await mount();
    await signIn('a');
    await act(async () => data.setDraftMeal({ name: 'A draft' }));
    await act(async () => {
        localStorage.setItem('token', 'session-b-fixture');
        window.dispatchEvent(new StorageEvent('storage', { key: 'token', storageArea: localStorage }));
    });
    expect(auth.user.id).toBe('B');
    expect(data.meals.map(meal => meal.name)).toEqual(['B meal']);
    expect(data.draftMeal.name).toBe('');
});

test('a failed meal refresh preserves the loaded data and a retry replaces it', async () => {
    await mount();
    await signIn('a');
    api.defaults.adapter = config => Promise.reject({ config, response: { status: 503, data: { message: 'Temporarily unavailable' } } });
    await act(async () => data.refreshMeals().catch(() => {}));
    expect(auth.user.id).toBe('A');
    expect(data.meals.map(meal => meal.name)).toEqual(['A meal']);
    expect(data.mealsError).toBe('Temporarily unavailable');
    expect(data.mealsLoading).toBe(false);
    api.defaults.adapter = config => Promise.resolve(reply(config, [{ name: 'Updated A meal' }]));
    await act(async () => data.refreshMeals());
    expect(data.meals.map(meal => meal.name)).toEqual(['Updated A meal']);
    expect(data.mealsError).toBe('');
});

test('overlapping refreshes cannot replace a newer meal list with an older response', async () => {
    await mount();
    await signIn('a');
    const completions = [];
    api.defaults.adapter = config => new Promise(resolve => completions.push(value => resolve(reply(config, value))));
    let older, newer;
    await act(async () => { older = data.refreshMeals(); });
    await act(async () => { newer = data.refreshMeals(); });
    await act(async () => { completions[1]([{ name: 'Latest meal' }]); await newer; });
    await act(async () => { completions[0]([{ name: 'Outdated meal' }]); await older; });
    expect(data.meals.map(meal => meal.name)).toEqual(['Latest meal']);
});

test('logout releases private draft previews and rejects a former account callback', async () => {
    await mount();
    await signIn('a');
    const previousRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = jest.fn();
    try {
        const oldData = data;
        await act(async () => data.setDraftMeal({ name: 'A image draft', previewUrl: 'blob:private-test-preview' }));
        await act(async () => auth.logout());
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-test-preview');
        await signIn('b');
        expect(() => oldData.setMeals([{ name: 'Late A mutation' }])).toThrow('The active session changed. Please try again.');
        expect(data.meals.map(meal => meal.name)).toEqual(['B meal']);
    } finally {
        URL.revokeObjectURL = previousRevoke;
    }
});
