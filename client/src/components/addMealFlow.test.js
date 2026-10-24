import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AddMeal from './AddMeal';
import api from '../utils/api';
import { setSessionToken } from '../utils/session';

jest.mock('react-router/dom', () => jest.requireActual('react-router/dist/development/dom-export.js'), { virtual: true });
jest.mock('react-router-dom', () => jest.requireActual('react-router-dom/dist/index.js'), { virtual: true });
jest.mock('../utils/api', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));
const mockSay = jest.fn();
const mockAssertSession = jest.fn();
const mockRefreshMeals = jest.fn();
jest.mock('../context/CarrotContext', () => ({ useCarrot: () => ({ say: mockSay }) }));
jest.mock('../context/UserDataContext', () => ({ useUserData: () => ({ assertSession: mockAssertSession, refreshMeals: mockRefreshMeals }) }));
jest.mock('./Rustic/ImageCropper', () => () => null);

const categories = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const savedMeal = { _id: 'owned-meal', name: 'Garden soup', ingredients: ['2 cup carrots'], category: 'Dinner', imageUrl: '' };
let container, root, draftState, mealsState, location;

function Screens({ draft }) {
    const [draftMeal, setDraftMeal] = useState(draft);
    const [meals, setMeals] = useState([savedMeal]);
    draftState = draftMeal;
    mealsState = meals;
    location = useLocation();
    return <Routes>
        <Route path="/" element={<AddMeal setMeals={setMeals} draftMeal={draftMeal} setDraftMeal={setDraftMeal} />} />
        <Route path="/available-meals" element={<div>Meal gallery</div>} />
    </Routes>;
}

const mount = async ({ draft, edit = false } = {}) => act(async () => root.render(
    <MemoryRouter initialEntries={[edit ? { pathname: '/', state: { mealId: savedMeal._id } } : '/']}>
        <Screens draft={draft} />
    </MemoryRouter>
));
const saveButton = () => container.querySelector('.recipe-save-button');
const occasion = () => container.querySelector('#meal-occasion');
const choices = () => [...occasion().querySelectorAll('[role="button"]')];
const choice = category => choices().find(element => element.getAttribute('aria-label') === category);
const click = async element => act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const feedback = () => container.querySelector('#meal-form-error');

async function change(element, value) {
    await act(async () => {
        const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype
            : element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
        element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    });
}

async function fillRecipe() {
    await change(container.querySelector('input[name="name"]'), 'Garden plate');
    const entry = container.querySelector('.ingredient-entry');
    await change(entry.querySelector('[aria-label="Ingredient quantity"]'), '2');
    await change(entry.querySelector('[aria-label="Ingredient unit"]'), 'cup');
    await change(entry.querySelector('[aria-label="Ingredient name"]'), 'carrots');
    await click(entry.querySelector('button[aria-label="Add ingredient"]'));
}

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    setSessionToken('add-form-fixture');
    jest.clearAllMocks();
    mockRefreshMeals.mockResolvedValue(undefined);
    api.get.mockResolvedValue({ data: savedMeal });
    api.post.mockImplementation(async (_url, body) => ({ data: {
        _id: 'created-meal', name: body.get('name'), ingredients: [body.get('ingredients')], category: body.get('category'),
    } }));
    api.put.mockImplementation(async (_url, body) => ({ data: {
        ...savedMeal, name: body.get('name'), ingredients: [body.get('ingredients')], category: body.get('category'),
    } }));
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    setSessionToken(null);
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test('the required occasion remains unselected and precedes Save in the single form', async () => {
    await mount();
    expect(container.querySelectorAll('form')).toHaveLength(1);
    expect(occasion().tagName).toBe('FIELDSET');
    expect(occasion().querySelector('legend').textContent).toMatch(/Meal occasion.*required/i);
    const help = container.querySelector('#meal-occasion-help');
    categories.forEach(category => expect(help.textContent).toContain(category));
    expect(choices().map(element => element.getAttribute('aria-label'))).toEqual(categories);
    expect(choices().every(element => element.getAttribute('aria-pressed') === 'false')).toBe(true);
    const form = container.querySelector('form');
    expect(form.contains(occasion())).toBe(true);
    expect(form.contains(saveButton())).toBe(true);
    expect(saveButton().type).toBe('button');
    expect(choices().every(element => Boolean(element.compareDocumentPosition(saveButton()) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
});

test('Add blocks a missing occasion, keeps the recipe, and focuses its first choice', async () => {
    jest.useFakeTimers();
    await mount();
    await fillRecipe();
    await click(saveButton());
    expect(feedback().textContent).toMatch(/choose.*occasion/i);
    expect(document.activeElement).toBe(choices()[0]);
    expect(draftState.name).toBe('Garden plate');
    expect(draftState.ingredients).toBe('2 cup carrots');
    expect(draftState.category).toBeUndefined();
    await act(async () => jest.advanceTimersByTime(6000));
    expect(feedback().textContent).toMatch(/choose.*occasion/i);
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
});

test.each(categories)('%s saves the existing multipart payload, including unchanged image and crop fields', async category => {
    const image = new File(['fixture image'], 'garden.png', { type: 'image/png' });
    await mount({ draft: { name: '  Garden plate  ', ingredients: '2 cup carrots', category: '', image,
        imageCrop: JSON.stringify({ x: 1, y: 2, width: 30, height: 40 }), previewUrl: '/fixture-image.png' } });
    await click(choice(category));
    expect(draftState.category).toBe(category);
    expect(choice(category).getAttribute('aria-pressed')).toBe('true');
    await click(saveButton());
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0][0]).toBe('/meals');
    const payload = api.post.mock.calls[0][1];
    expect([...payload.keys()]).toEqual(['name', 'ingredients', 'category', 'cropX', 'cropY', 'cropWidth', 'cropHeight', 'image']);
    expect(payload.get('name')).toBe('Garden plate');
    expect(payload.get('ingredients')).toBe('2 cup carrots');
    expect(payload.get('category')).toBe(category);
    expect(['cropX', 'cropY', 'cropWidth', 'cropHeight'].map(key => payload.get(key))).toEqual(['1', '2', '30', '40']);
    expect(payload.get('image')).toBe(image);
    expect(api.put).not.toHaveBeenCalled();
    expect(mockRefreshMeals).toHaveBeenCalledTimes(1);
    expect(mealsState[1].category).toBe(category);
    expect(location.pathname).toBe('/');
    expect(draftState.category).toBe('');
    expect(container.querySelector('[role="status"]').textContent).toMatch(/meal added successfully/i);
    expect(choices().every(element => element.getAttribute('aria-pressed') === 'false')).toBe(true);
});

test('a saved draft occasion is retained and real wheel keyboard activation updates it', async () => {
    await mount({ draft: { name: 'Draft soup', ingredients: '1 cup rice', category: 'Snack' } });
    expect(choice('Snack').getAttribute('aria-pressed')).toBe('true');
    const breakfast = choice('Breakfast');
    breakfast.focus();
    await act(async () => breakfast.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
    expect(choice('Breakfast').getAttribute('aria-pressed')).toBe('true');
    expect(draftState.category).toBe('Breakfast');
    const lunch = choice('Lunch');
    lunch.focus();
    await act(async () => lunch.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })));
    expect(choice('Lunch').getAttribute('aria-pressed')).toBe('true');
    expect(draftState.category).toBe('Lunch');
    expect(api.post).not.toHaveBeenCalled();
});

test('Edit keeps the saved occasion and existing update payload and gallery return', async () => {
    jest.useFakeTimers();
    await mount({ edit: true });
    expect(api.get.mock.calls[0][0]).toBe('/meals/owned-meal');
    expect(choice('Dinner').getAttribute('aria-pressed')).toBe('true');
    await change(container.querySelector('input[name="name"]'), 'Updated garden soup');
    await click(saveButton());
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put.mock.calls[0][0]).toBe('/meals/owned-meal');
    expect([...api.put.mock.calls[0][1].entries()]).toEqual([
        ['name', 'Updated garden soup'], ['ingredients', '2 cup carrots'], ['category', 'Dinner'],
    ]);
    expect(api.post).not.toHaveBeenCalled();
    expect(mockRefreshMeals).toHaveBeenCalledTimes(1);
    expect(mealsState[0].name).toBe('Updated garden soup');
    expect(location.state).toBeNull();
    expect(container.querySelector('[role="status"]').textContent).toMatch(/meal updated successfully/i);
    await act(async () => jest.advanceTimersByTime(1999));
    expect(location.pathname).toBe('/');
    await act(async () => jest.advanceTimersByTime(1));
    expect(location.pathname).toBe('/available-meals');
});

test('Edit with no saved occasion remains unselected and cannot send an update', async () => {
    api.get.mockResolvedValue({ data: { ...savedMeal, category: '' } });
    await mount({ edit: true });
    expect(choices().every(element => element.getAttribute('aria-pressed') === 'false')).toBe(true);
    await click(saveButton());
    expect(feedback().textContent).toMatch(/choose.*occasion/i);
    expect(document.activeElement).toBe(choices()[0]);
    expect(container.querySelector('input[name="name"]').value).toBe(savedMeal.name);
    expect(api.put).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
});

test('visible field labels and ingredient Enter keep entry values and prevent accidental meal submission', async () => {
    await mount();
    const name = container.querySelector('#meal-name');
    expect([...name.labels].some(label => /Meal name/i.test(label.textContent))).toBe(true);
    expect(container.textContent).toMatch(/Ingredients.*required/i);
    expect(container.textContent).toMatch(/Photo.*optional/i);
    const entry = container.querySelector('.ingredient-entry');
    for (const control of entry.querySelectorAll('input, select')) expect(control.labels.length).toBeGreaterThan(0);
    await change(entry.querySelector('[aria-label="Ingredient quantity"]'), '2');
    await change(entry.querySelector('[aria-label="Ingredient unit"]'), 'cup');
    const ingredient = entry.querySelector('[aria-label="Ingredient name"]');
    await change(ingredient, 'rice');
    await act(async () => ingredient.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
    expect(draftState.ingredients).toBe('2 cup rice');
    expect(entry.querySelector('[aria-label="Ingredient unit"]').value).toBe('x');
    expect(ingredient.value).toBe('');
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
});

test('paste-list guidance keeps the existing provider request and ingredient result', async () => {
    await mount();
    await click([...container.querySelectorAll('button')].find(button => /Paste ingredient list/.test(button.textContent)));
    const input = container.querySelector('.ingredient-manager textarea');
    expect(input.labels.length).toBeGreaterThan(0);
    const help = input.getAttribute('aria-describedby').split(/\s+/).map(id => container.querySelector(`#${id}`).textContent).join(' ');
    expect(help).toMatch(/line|comma/i);
    expect(help).toContain('choose Add ingredients');
    expect([...container.querySelectorAll('button')].some(button => button.textContent === 'Add one ingredient')).toBe(true);
    const list = '1 cup rice\n500 g carrots';
    await change(input, list);
    let finish;
    api.post.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await click([...container.querySelectorAll('button')].find(button => /Add ingredients/.test(button.textContent)));
    const pending = [...container.querySelectorAll('button')].find(button => button.textContent === 'Reading ingredients...');
    expect(pending.disabled).toBe(true);
    expect(api.post.mock.calls).toEqual([['/ai/parse', { text: list }]]);
    await act(async () => finish({ data: [{ qty: '1', unit: 'cup', name: 'rice' }, { qty: '500', unit: 'g', name: 'carrots' }] }));
    expect(draftState.ingredients).toBe('1 cup rice, 500 g carrots');
    expect(container.querySelector('.ingredient-manager textarea')).toBeNull();
    expect(choices().every(element => element.getAttribute('aria-pressed') === 'false')).toBe(true);
});
