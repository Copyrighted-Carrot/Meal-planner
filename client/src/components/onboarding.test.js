import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import StarterPackModal from './StarterPackModal';
import SmartImportModal from './SmartImportModal';
import api from '../utils/api';
import { setSessionToken } from '../utils/session';

let container, root, originalAdapter;
beforeEach(() => {
    setSessionToken('onboarding-account-fixture');
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
const click = text => [...container.querySelectorAll('button')].find(button => button.textContent.includes(text)).click();

test('Starter Pack imports with authentication and refreshes shared meals', async () => {
    const imported = jest.fn();
    api.defaults.adapter = jest.fn(async config => {
        expect(config.url).toBe('/meals/import-starter-pack');
        expect(config.headers.get('x-auth-token')).toBe('onboarding-account-fixture');
        return { config, status: 200, data: {} };
    });
    await act(async () => root.render(<StarterPackModal isOpen onImport={imported} onClose={() => {}} />));
    await act(async () => click('Import Starter Pack'));
    expect(api.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(imported).toHaveBeenCalledTimes(1);
});

test('Smart Fridge suggestion and copy requests both carry authentication', async () => {
    const imported = jest.fn();
    const paths = [];
    api.defaults.adapter = async config => {
        paths.push(config.url);
        expect(config.headers.get('x-auth-token')).toBe('onboarding-account-fixture');
        return { config, status: 200, data: config.url.endsWith('/suggest') ? [{ _id: 'public-meal', name: 'Soup', ingredients: ['carrot'] }] : {} };
    };
    await act(async () => root.render(<SmartImportModal isOpen onImport={imported} onClose={() => {}} />));
    const textarea = container.querySelector('textarea');
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'carrot');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => click('Find Recipes'));
    await act(async () => click('Add'));
    expect(paths).toEqual(['/meals/suggest', '/meals/copy/public-meal']);
    expect(imported).toHaveBeenCalledTimes(1);
});
