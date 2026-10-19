import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import GlobalMealList from './GlobalMealList';
import SmartImportModal from './SmartImportModal';
import StarterPackModal from './StarterPackModal';
import api from '../utils/api';
import { setSessionToken } from '../utils/session';

const meal = { _id: 'public-soup', name: 'Garden soup', category: 'Lunch', ingredients: ['carrot'] };
let container, root, originalAdapter;

beforeEach(() => {
    setSessionToken('import-feedback-fixture');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    originalAdapter = api.defaults.adapter;
    jest.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    api.defaults.adapter = originalAdapter;
    setSessionToken(null);
    jest.restoreAllMocks();
});

function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

const response = (config, data = {}) => ({ config, status: 200, data });
const failure = (config, status = 503) => ({ config, response: { status, data: { message: 'Fixture request failed.' } } });
const button = pattern => [...container.querySelectorAll('button')].find(element => pattern.test(element.textContent));
const click = pattern => button(pattern).click();
const text = () => container.textContent;

async function enterIngredients(value = 'carrot, potato') {
    const textarea = container.querySelector('textarea');
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, value);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function showSuggestions(onImport = jest.fn()) {
    await act(async () => root.render(<SmartImportModal isOpen onImport={onImport} onClose={() => {}} />));
    await enterIngredients();
    await act(async () => click(/Find Recipes/));
}

test('Browse distinguishes the initial loading state from a loaded recipe library', async () => {
    const request = deferred();
    api.defaults.adapter = jest.fn(config => request.promise.then(data => response(config, data)));
    await act(async () => root.render(<GlobalMealList meals={[]} onImport={jest.fn()} />));
    expect(text()).toMatch(/Loading Library/);
    expect(text()).not.toMatch(/No global meals found|Could not load/);
    await act(async () => request.resolve([meal]));
    expect(text()).toContain(meal.name);
    expect(text()).not.toMatch(/Loading Library|No global meals found|Could not load/);
});

test('Browse shows a useful empty state only after a successful empty response', async () => {
    api.defaults.adapter = jest.fn(async config => response(config, []));
    await act(async () => root.render(<GlobalMealList meals={[]} onImport={jest.fn()} />));
    expect(text()).toContain('No global meals found. Please check back later.');
    expect(text()).not.toMatch(/Be the first to publish|Loading Library|Could not load/);
    expect(button(/Retry/)).toBeUndefined();
});

test('Browse failed loading is not reported as empty and Retry loads the library', async () => {
    const retry = deferred();
    api.defaults.adapter = jest.fn()
        .mockImplementationOnce(config => Promise.reject(failure(config)))
        .mockImplementationOnce(config => retry.promise.then(data => response(config, data)));
    await act(async () => root.render(<GlobalMealList meals={[]} onImport={jest.fn()} />));
    expect(container.querySelector('[role="alert"]').textContent).toContain('Could not load the recipe library. Please try again.');
    expect(text()).not.toMatch(/No global meals found/);
    await act(async () => click(/Retry/));
    expect(text()).toMatch(/Loading Library/);
    expect(text()).not.toMatch(/No global meals found|Could not load/);
    await act(async () => retry.resolve([meal]));
    expect(text()).toContain(meal.name);
    expect(api.defaults.adapter).toHaveBeenCalledTimes(2);
});

test.each(['expired', 'switched'])('Browse does not show successful-empty feedback for an %s session', async kind => {
    const pending = deferred();
    api.defaults.adapter = jest.fn(config => kind === 'expired'
        ? Promise.reject(failure(config, 401))
        : pending.promise.then(() => response(config, [])));
    await act(async () => root.render(<GlobalMealList meals={[]} onImport={jest.fn()} />));
    if (kind === 'switched') {
        await act(async () => {
            setSessionToken('different-library-account-fixture');
            pending.resolve();
        });
    }
    expect(text()).not.toMatch(/No global meals found|Could not load the recipe library/);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(button(/Retry/)).toBeUndefined();
});

test('Smart Fridge stays Adding until copy and shared-meal refresh both finish', async () => {
    const copy = deferred();
    const refresh = deferred();
    const onImport = jest.fn(() => refresh.promise);
    api.defaults.adapter = jest.fn(config => config.url.endsWith('/suggest')
        ? Promise.resolve(response(config, [meal]))
        : copy.promise.then(() => response(config)));
    await showSuggestions(onImport);
    await act(async () => click(/^Add$/));
    expect(button(/^Adding\.\.\.$/).disabled).toBe(true);
    expect(button(/^Added$/)).toBeUndefined();
    expect(onImport).not.toHaveBeenCalled();
    await act(async () => copy.resolve());
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(button(/^Adding\.\.\.$/).disabled).toBe(true);
    expect(button(/^Added$/)).toBeUndefined();
    expect(window.alert).not.toHaveBeenCalled();
    await act(async () => refresh.resolve());
    expect(button(/^Added$/).disabled).toBe(true);
    expect(button(/^Adding\.\.\.$/)).toBeUndefined();
});

test('Smart Fridge reports copy failure inline and Retry copies the same recipe', async () => {
    let copyAttempts = 0;
    const onImport = jest.fn();
    api.defaults.adapter = jest.fn(async config => {
        if (config.url.endsWith('/suggest')) return response(config, [meal]);
        copyAttempts += 1;
        if (copyAttempts === 1) throw failure(config);
        return response(config);
    });
    await showSuggestions(onImport);
    await act(async () => click(/^Add$/));
    expect(container.querySelector('[role="alert"]').textContent).toContain('Could not add this meal. Please try again.');
    expect(onImport).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
    await act(async () => click(/Retry/));
    expect(copyAttempts).toBe(2);
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(button(/^Added$/).disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')).toBeNull();
});

test('Smart Fridge retries only refresh when copy succeeded but shared meals did not reload', async () => {
    const onImport = jest.fn()
        .mockRejectedValueOnce(new Error('Fixture refresh failed.'))
        .mockResolvedValueOnce(undefined);
    api.defaults.adapter = jest.fn(async config => response(config, config.url.endsWith('/suggest') ? [meal] : {}));
    await showSuggestions(onImport);
    await act(async () => click(/^Add$/));
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(button(/^Added$/)).toBeUndefined();
    await act(async () => click(/Retry/));
    expect(onImport).toHaveBeenCalledTimes(2);
    expect(api.defaults.adapter.mock.calls.filter(([config]) => config.url === `/meals/copy/${meal._id}`)).toHaveLength(1);
    expect(button(/^Added$/).disabled).toBe(true);
});

test('Smart Fridge completed feedback does not permanently block copying on a later visit', async () => {
    const onImport = jest.fn();
    api.defaults.adapter = jest.fn(async config => response(config, config.url.endsWith('/suggest') ? [meal] : {}));
    await showSuggestions(onImport);
    await act(async () => click(/^Add$/));
    expect(button(/^Added$/).disabled).toBe(true);
    await act(async () => root.render(<SmartImportModal isOpen={false} onImport={onImport} onClose={() => {}} />));
    await act(async () => root.render(<SmartImportModal isOpen onImport={onImport} onClose={() => {}} />));
    // The user may have removed the imported recipe while this dialog was closed.
    expect(button(/^Add$/).disabled).toBe(false);
    expect(button(/^Added$/)).toBeUndefined();
    await act(async () => click(/^Add$/));
    expect(api.defaults.adapter.mock.calls.filter(([config]) => config.url === `/meals/copy/${meal._id}`)).toHaveLength(2);
    expect(onImport).toHaveBeenCalledTimes(2);
});

test('Smart Fridge preserves a refresh-only retry when the dialog is closed and reopened', async () => {
    const onImport = jest.fn()
        .mockRejectedValueOnce(new Error('Fixture refresh failed.'))
        .mockResolvedValueOnce(undefined);
    api.defaults.adapter = jest.fn(async config => response(config, config.url.endsWith('/suggest') ? [meal] : {}));
    await showSuggestions(onImport);
    await act(async () => click(/^Add$/));
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => root.render(<SmartImportModal isOpen={false} onImport={onImport} onClose={() => {}} />));
    await act(async () => root.render(<SmartImportModal isOpen onImport={onImport} onClose={() => {}} />));
    await act(async () => click(/Retry/));
    expect(onImport).toHaveBeenCalledTimes(2);
    expect(api.defaults.adapter.mock.calls.filter(([config]) => config.url === `/meals/copy/${meal._id}`)).toHaveLength(1);
    expect(button(/^Added$/).disabled).toBe(true);
});

test('Smart Fridge explains zero matches and retains the ingredients for another search', async () => {
    api.defaults.adapter = jest.fn(async config => response(config, []));
    await showSuggestions();
    expect(text()).toContain('No recipes matched these ingredients. Try a different combination.');
    expect(container.querySelector('textarea').value).toBe('carrot, potato');
    expect(button(/Find Recipes/).disabled).toBe(false);
    expect(container.querySelector('[role="alert"]')).toBeNull();
});

test('Smart Fridge suggestion failure is retryable without retyping ingredients', async () => {
    api.defaults.adapter = jest.fn()
        .mockImplementationOnce(config => Promise.reject(failure(config)))
        .mockImplementationOnce(async config => response(config, [meal]));
    await showSuggestions();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector('textarea').value).toBe('carrot, potato');
    expect(text()).not.toMatch(/No recipes matched/);
    expect(window.alert).not.toHaveBeenCalled();
    await act(async () => click(/Retry/));
    expect(text()).toContain(meal.name);
    expect(api.defaults.adapter).toHaveBeenCalledTimes(2);
    const retriedConfig = api.defaults.adapter.mock.calls[1][0];
    expect(JSON.parse(retriedConfig.data)).toEqual({ ingredients: 'carrot, potato' });
});

test('Starter Pack locks switch, dismissal and repeat import through the refresh stage', async () => {
    const imported = deferred();
    const refresh = deferred();
    const onImport = jest.fn(() => refresh.promise);
    const onClose = jest.fn();
    const onSwitch = jest.fn();
    api.defaults.adapter = jest.fn(config => imported.promise.then(() => response(config)));
    await act(async () => root.render(<StarterPackModal isOpen onImport={onImport} onClose={onClose} onSwitch={onSwitch} />));
    await act(async () => click(/Import Starter Pack/));
    for (const control of container.querySelectorAll('button')) expect(control.disabled).toBe(true);
    expect(button(/Importing/)).toBeDefined();
    await act(async () => {
        click(/suggest meals/);
        click(/start from scratch/);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(onSwitch).not.toHaveBeenCalled();
    await act(async () => imported.resolve());
    expect(onImport).toHaveBeenCalledTimes(1);
    for (const control of container.querySelectorAll('button')) expect(control.disabled).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
    await act(async () => refresh.resolve());
    expect(onClose).toHaveBeenCalledTimes(1);
    if (window.alert.mock.calls.length) {
        expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(window.alert.mock.invocationCallOrder[0]);
    }
    expect(api.defaults.adapter).toHaveBeenCalledTimes(1);
});

test('Starter Pack failure remains visible with Retry and restores alternate actions', async () => {
    const onImport = jest.fn();
    const onClose = jest.fn();
    api.defaults.adapter = jest.fn()
        .mockImplementationOnce(config => Promise.reject(failure(config)))
        .mockImplementationOnce(async config => response(config));
    await act(async () => root.render(<StarterPackModal isOpen onImport={onImport} onClose={onClose} onSwitch={jest.fn()} />));
    await act(async () => click(/Import Starter Pack/));
    expect(container.querySelector('[role="alert"]').textContent).toContain('Could not import the starter pack. Please try again.');
    expect(button(/suggest meals/).disabled).toBe(false);
    expect(button(/start from scratch/).disabled).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
    await act(async () => click(/Retry/));
    expect(api.defaults.adapter).toHaveBeenCalledTimes(2);
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
});

test('Starter Pack Retry refreshes existing imports without posting another starter pack', async () => {
    const onImport = jest.fn()
        .mockRejectedValueOnce(new Error('Fixture refresh failed.'))
        .mockResolvedValueOnce(undefined);
    const onClose = jest.fn();
    api.defaults.adapter = jest.fn(async config => response(config));
    await act(async () => root.render(<StarterPackModal isOpen onImport={onImport} onClose={onClose} onSwitch={jest.fn()} />));
    await act(async () => click(/Import Starter Pack/));
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
    await act(async () => click(/Retry/));
    expect(onImport).toHaveBeenCalledTimes(2);
    expect(api.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
});

test.each(['Smart Fridge', 'Starter Pack'])('%s leaves expired-session handling to the existing auth flow', async kind => {
    api.defaults.adapter = jest.fn(async config => {
        if (config.url.endsWith('/suggest')) return response(config, [meal]);
        throw failure(config, 401);
    });
    const onImport = jest.fn();
    const onClose = jest.fn();
    if (kind === 'Smart Fridge') {
        await showSuggestions(onImport);
        await act(async () => click(/^Add$/));
    } else {
        await act(async () => root.render(<StarterPackModal isOpen onImport={onImport} onClose={onClose} onSwitch={jest.fn()} />));
        await act(async () => click(/Import Starter Pack/));
    }
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(onImport).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
    expect(button(/Retry/)).toBeUndefined();
});

test.each(['Smart Fridge', 'Starter Pack'])('%s does not report success for an import completed after account switching', async kind => {
    const pending = deferred();
    const onImport = jest.fn();
    const onClose = jest.fn();
    api.defaults.adapter = jest.fn(config => config.url.endsWith('/suggest')
        ? Promise.resolve(response(config, [meal]))
        : pending.promise.then(() => response(config)));
    if (kind === 'Smart Fridge') {
        await showSuggestions(onImport);
        await act(async () => click(/^Add$/));
    } else {
        await act(async () => root.render(<StarterPackModal isOpen onImport={onImport} onClose={onClose} onSwitch={jest.fn()} />));
        await act(async () => click(/Import Starter Pack/));
    }
    await act(async () => {
        setSessionToken('different-import-account-fixture');
        pending.resolve();
    });
    expect(onImport).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(button(/^Added$/)).toBeUndefined();
});
