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
    expect(container.querySelector('h2').textContent).toContain('Browse Recipes');
    expect(text()).toMatch(/Loading recipes/);
    expect(text()).not.toMatch(/No recipes to browse yet|Could not load/);
    await act(async () => request.resolve([meal]));
    expect(text()).toContain(meal.name);
    expect(text()).not.toMatch(/Loading recipes|No recipes to browse yet|Could not load/);
});

test('Browse shows a useful empty state only after a successful empty response', async () => {
    api.defaults.adapter = jest.fn(async config => response(config, []));
    await act(async () => root.render(<GlobalMealList meals={[]} onImport={jest.fn()} />));
    expect(text()).toContain('No recipes to browse yet.');
    expect(text()).not.toMatch(/Be the first to publish|Loading recipes|Could not load/);
    expect(button(/Retry/)).toBeUndefined();
});

test('Browse failed loading is not reported as empty and Retry loads the library', async () => {
    const retry = deferred();
    api.defaults.adapter = jest.fn()
        .mockImplementationOnce(config => Promise.reject(failure(config)))
        .mockImplementationOnce(config => retry.promise.then(data => response(config, data)));
    await act(async () => root.render(<GlobalMealList meals={[]} onImport={jest.fn()} />));
    expect(container.querySelector('[role="alert"]').textContent).toContain('Could not load the recipe library. Please try again.');
    expect(text()).not.toMatch(/No recipes to browse yet/);
    await act(async () => click(/Retry/));
    expect(text()).toMatch(/Loading recipes/);
    expect(text()).not.toMatch(/No recipes to browse yet|Could not load/);
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
    expect(text()).not.toMatch(/No recipes to browse yet|Could not load the recipe library/);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(button(/Retry/)).toBeUndefined();
});

test('Add to Available Meals still copies the selected recipe once and refreshes before success', async () => {
    const pending = deferred();
    const refresh = deferred();
    const onImport = jest.fn(() => refresh.promise);
    api.defaults.adapter = jest.fn(config => config.method === 'get'
        ? Promise.resolve(response(config, [meal])) : pending.promise.then(() => response(config)));
    await act(async () => root.render(<GlobalMealList meals={[]} onImport={onImport} />));
    const add = button(/Add to Available Meals/);
    add.focus();
    await act(async () => add.click());
    expect(add.textContent).toBe('Adding...');
    expect(add.disabled).toBe(true);
    const writes = api.defaults.adapter.mock.calls.map(([config]) => config).filter(config => config.method === 'post');
    expect(writes).toHaveLength(1);
    expect(writes[0].url).toBe('/meals/copy/public-soup');
    expect(writes[0].data).toBeUndefined();
    expect(onImport).not.toHaveBeenCalled();
    await act(async () => pending.resolve());
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(window.alert).not.toHaveBeenCalled();
    await act(async () => refresh.resolve());
    expect(window.alert).toHaveBeenCalledTimes(1);
    expect(add.textContent).toContain('Add to Available Meals');
    expect(add.disabled).toBe(false);
});

test('Smart Fridge secondary controls preserve close, back and keyboard focus behavior', async () => {
    const onBack = jest.fn();
    const onClose = jest.fn();
    api.defaults.adapter = jest.fn();
    function Flow() {
        const [open, setOpen] = React.useState(false);
        return <>
            <button onClick={() => setOpen(true)}>Open fridge</button>
            <SmartImportModal isOpen={open} onImport={jest.fn()} onBack={onBack}
                onClose={() => { onClose(); setOpen(false); }} />
        </>;
    }
    const key = (name, shiftKey = false) => document.activeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true }));
    await act(async () => root.render(<Flow />));
    const opener = button(/^Open fridge$/);
    opener.focus();
    await act(async () => opener.click());
    const closeIcon = container.querySelector('[aria-label="Close Smart Fridge"]');
    const close = button(/^Close$/);
    expect(close.classList.contains('btn-outline-secondary')).toBe(true);
    expect(document.activeElement).toBe(closeIcon);
    await act(async () => key('Tab', true));
    expect(document.activeElement).toBe(close);
    await act(async () => key('Tab'));
    expect(document.activeElement).toBe(closeIcon);
    await act(async () => click(/^Back to Starter Pack$/));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => key('Escape'));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => opener.click());
    await act(async () => click(/^Close$/));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(api.defaults.adapter).not.toHaveBeenCalled();
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
    expect(container.querySelector('[role="status"]').classList.contains('alert-info')).toBe(true);
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
    expect(container.querySelector('[role="alert"]').classList.contains('page-state')).toBe(true);
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
    expect(container.querySelector('[role="status"]').classList.contains('page-state-empty')).toBe(true);
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

test('Starter Pack guards same-turn conflicting actions and stays locked through the refresh stage', async () => {
    const imported = deferred();
    const refresh = deferred();
    const onImport = jest.fn(() => refresh.promise);
    const onClose = jest.fn();
    const onSwitch = jest.fn();
    api.defaults.adapter = jest.fn(config => imported.promise.then(() => response(config)));
    await act(async () => root.render(<StarterPackModal isOpen onImport={onImport} onClose={onClose} onSwitch={onSwitch} />));
    await act(async () => {
        const importButton = button(/Import Starter Pack/);
        importButton.click();
        importButton.click();
        click(/suggest meals/);
        click(/start from scratch/);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(api.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(onImport).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSwitch).not.toHaveBeenCalled();
    for (const control of container.querySelectorAll('button')) expect(control.disabled).toBe(true);
    expect(button(/^Importing\.\.\.$/)).toBeDefined();
    expect(container.querySelector('[role="status"]').textContent).toContain('Importing your starter pack...');
    await act(async () => {
        click(/suggest meals/);
        click(/start from scratch/);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(onSwitch).not.toHaveBeenCalled();
    await act(async () => imported.resolve());
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(button(/^Refreshing\.\.\.$/)).toBeDefined();
    expect(container.querySelector('[role="status"]').textContent).toContain('Refreshing your meals...');
    for (const control of container.querySelectorAll('button')) expect(control.disabled).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
    await act(async () => refresh.resolve());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(window.alert).toHaveBeenCalledTimes(1);
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Starter pack imported!'));
    expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(window.alert.mock.invocationCallOrder[0]);
    expect(api.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="status"]')).toBeNull();
    for (const control of container.querySelectorAll('button')) expect(control.disabled).toBe(false);
});

test('Starter Pack failure remains visible with Retry and restores alternate actions', async () => {
    const retry = deferred();
    const onImport = jest.fn();
    const onClose = jest.fn();
    const onSwitch = jest.fn();
    api.defaults.adapter = jest.fn()
        .mockImplementationOnce(config => Promise.reject(failure(config)))
        .mockImplementationOnce(config => retry.promise.then(() => response(config)));
    await act(async () => root.render(<StarterPackModal isOpen onImport={onImport} onClose={onClose} onSwitch={onSwitch} />));
    await act(async () => click(/Import Starter Pack/));
    expect(container.querySelector('[role="alert"]').textContent).toContain('Could not import the starter pack. Please try again.');
    expect(button(/suggest meals/).disabled).toBe(false);
    expect(button(/start from scratch/).disabled).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
    await act(async () => {
        click(/suggest meals/);
        click(/start from scratch/);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
    onSwitch.mockClear();
    onClose.mockClear();
    await act(async () => {
        const retryButton = button(/^Retry$/);
        retryButton.click();
        retryButton.click();
        click(/Import Starter Pack/);
        click(/suggest meals/);
        click(/start from scratch/);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(api.defaults.adapter).toHaveBeenCalledTimes(2);
    expect(onImport).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSwitch).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    for (const control of container.querySelectorAll('button')) expect(control.disabled).toBe(true);
    await act(async () => retry.resolve());
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
});

test('Starter Pack Retry refreshes existing imports without posting another starter pack', async () => {
    const refresh = deferred();
    const onImport = jest.fn()
        .mockRejectedValueOnce(new Error('Fixture refresh failed.'))
        .mockImplementationOnce(() => refresh.promise);
    const onClose = jest.fn();
    const onSwitch = jest.fn();
    api.defaults.adapter = jest.fn(async config => response(config));
    await act(async () => root.render(<StarterPackModal isOpen onImport={onImport} onClose={onClose} onSwitch={onSwitch} />));
    await act(async () => click(/Import Starter Pack/));
    expect(container.querySelector('[role="alert"]').textContent).toContain('Starter pack imported, but your collection could not be refreshed. Retry to reload your meals.');
    expect(button(/^Refresh meals$/).disabled).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
    await act(async () => {
        const retryButton = button(/^Retry$/);
        retryButton.click();
        retryButton.click();
        click(/^Refresh meals$/);
        click(/suggest meals/);
        click(/start from scratch/);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onImport).toHaveBeenCalledTimes(2);
    expect(api.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="status"]').textContent).toContain('Refreshing your meals...');
    expect(text()).not.toContain('Importing your starter pack...');
    for (const control of container.querySelectorAll('button')) expect(control.disabled).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(onSwitch).not.toHaveBeenCalled();
    await act(async () => refresh.resolve());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(api.defaults.adapter).toHaveBeenCalledTimes(1);
});

test('Starter Pack retains its existing keyboard trap while pending and restores focus after recovery', async () => {
    const request = deferred();
    const onSwitch = jest.fn();
    api.defaults.adapter = jest.fn(config => request.promise.then(() => response(config)));
    function Flow() {
        const [open, setOpen] = React.useState(false);
        return <>
            <button onClick={() => setOpen(true)}>Open starter pack</button>
            <StarterPackModal isOpen={open} onImport={jest.fn()} onClose={() => setOpen(false)} onSwitch={onSwitch} />
        </>;
    }
    const key = (name, shiftKey = false) => document.activeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true }));
    await act(async () => root.render(<Flow />));
    const opener = button(/^Open starter pack$/);
    opener.focus();
    await act(async () => opener.click());
    expect(document.activeElement).toBe(button(/suggest meals/));
    expect(button(/start from scratch/).classList.contains('btn-outline-secondary')).toBe(true);
    await act(async () => click(/suggest meals/));
    expect(onSwitch).toHaveBeenCalledTimes(1);
    await act(async () => key('Escape'));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);

    await act(async () => opener.click());
    await act(async () => click(/Import Starter Pack/));
    const dialog = container.querySelector('[role="dialog"]');
    await act(async () => key('Tab'));
    expect(document.activeElement).toBe(dialog);
    await act(async () => key('Tab', true));
    expect(document.activeElement).toBe(dialog);
    await act(async () => key('Escape'));
    expect(container.querySelector('[role="dialog"]')).toBe(dialog);
    await act(async () => request.reject(new Error('Fixture import failed.')));
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => key('Tab'));
    expect(document.activeElement).toBe(button(/^Retry$/));
    await act(async () => key('Tab', true));
    expect(document.activeElement).toBe(button(/Import Starter Pack/));
    await act(async () => key('Escape'));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(api.defaults.adapter).toHaveBeenCalledTimes(1);
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
