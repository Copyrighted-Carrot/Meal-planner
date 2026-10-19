import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import IngredientManager from './Rustic/IngredientManager';
import MealCard from './Rustic/MealCard';

jest.mock('../context/CarrotContext', () => ({ useCarrot: () => ({ say: jest.fn() }) }));
jest.mock('../utils/api', () => ({ post: jest.fn() }));

const units = [
    ['x', '-'], ['g', 'Gram'], ['kg', 'Kilogram'], ['ml', 'Millilitre'],
    ['l', 'Litre'], ['cup', 'Cup'], ['tbsp', 'Table Spoon'], ['tsp', 'Tea Spoon'],
    ['bunch', 'Bunch'], ['pinch', 'Pinch'], ['packet', 'Packet'], ['handful', 'Handful'],
    ['piece', 'Piece'], ['slice', 'Slice'], ['spoon', 'Spoon'], ['glass', 'Glass'],
    ['bowl', 'Bowl'], ['count', 'Count'], ['can', 'Can'],
];
const meal = { _id: 'selection-meal-id', name: 'Garden soup', category: 'Dinner', ingredients: ['2 cup carrots'] };
let container, root, onIngredientsChange, onToggle, onEdit, onDelete;

function Ingredients({ initial = '' }) {
    const [ingredients, setIngredients] = useState(initial);
    return <IngredientManager ingredients={ingredients} onChange={value => {
        onIngredientsChange(value);
        setIngredients(value);
    }} />;
}

function Meal({ selectionMode = true, initialSelected = false }) {
    const [selected, setSelected] = useState(initialSelected);
    return <MealCard meal={meal} selectionMode={selectionMode} isSelected={selected}
        onEdit={onEdit} onDelete={onDelete} onToggle={id => {
            onToggle(id);
            setSelected(value => !value);
        }} />;
}

const mount = async component => act(async () => root.render(component));
const click = async element => act(async () => element.click());
const entry = () => container.querySelector('.ingredient-entry');
const entryUnit = () => entry().querySelector('select');
const editor = () => container.querySelector('.ingredient-chip-edit');
const editButton = () => container.querySelector('.ingredient-chip-label');
const checkbox = () => container.querySelector('input[type="checkbox"]');

async function change(element, value) {
    await act(async () => {
        const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
        element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    });
}

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onIngredientsChange = jest.fn();
    onToggle = jest.fn();
    onEdit = jest.fn();
    onDelete = jest.fn();
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
});

// JSDOM does not synthesize native Tab/Arrow/Enter/Space default actions.
// These tests check native semantics, focus and activation; real keyboard input is checked in Chrome.
test('ingredient unit selector is labelled, natively focusable, and retains every existing option', async () => {
    await mount(<Ingredients />);
    const select = entryUnit();
    expect(select).not.toBeNull();
    expect(select.getAttribute('aria-label')).toBe('Ingredient unit');
    expect(select.tabIndex).toBe(0);
    expect(select.disabled).toBe(false);
    expect(select.value).toBe('x');
    expect([...select.options].map(option => [option.value, option.textContent])).toEqual(units);
    select.focus();
    expect(document.activeElement).toBe(select);
    expect(onIngredientsChange).not.toHaveBeenCalled();
});

test.each(units)('selecting unit %s preserves the ingredient payload and resets the entry default', async (unit) => {
    await mount(<Ingredients />);
    await change(entry().querySelector('input[type="number"]'), '2');
    await change(entryUnit(), unit);
    await change(entry().querySelector('.ingredient-name-input'), 'rice');
    expect(entryUnit().value).toBe(unit);
    expect(onIngredientsChange).not.toHaveBeenCalled();
    await click([...entry().querySelectorAll('button')].find(button => button.textContent === '+'));
    expect(onIngredientsChange.mock.calls).toEqual([[unit === 'x' ? '2  rice' : `2 ${unit} rice`]]);
    expect(entryUnit().value).toBe('x');
    expect(entry().querySelector('input[type="number"]').value).toBe('');
    expect(entry().querySelector('.ingredient-name-input').value).toBe('');
});

test('ingredient edit uses a named native button, keeps existing values, and returns focus when done', async () => {
    await mount(<Ingredients initial="1/2 cup rice, 2 pc carrots" />);
    const button = editButton();
    expect(button.tagName).toBe('BUTTON');
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Edit ingredient: 1/2 cup rice');
    expect(button.tabIndex).toBe(0);
    button.focus();
    expect(document.activeElement).toBe(button);
    await click(button);
    const quantity = editor().querySelector('[aria-label="Ingredient quantity"]');
    expect(document.activeElement).toBe(quantity);
    expect(quantity.value).toBe('1/2');
    expect(editor().querySelector('[aria-label="Ingredient unit"]').value).toBe('cup');
    expect(editor().querySelector('[aria-label="Ingredient name"]').value).toBe('rice');
    expect(onIngredientsChange).not.toHaveBeenCalled();
    await click(editor().querySelector('[aria-label="Done editing ingredient"]'));
    expect(editor()).toBeNull();
    expect(document.activeElement).toBe(editButton());
    expect(onIngredientsChange).not.toHaveBeenCalled();
});

test('editing quantity, unit and name keeps the existing string data flow and extra pc option', async () => {
    await mount(<Ingredients initial="1/2 cup rice, 2 pc carrots" />);
    await click(editButton());
    const select = editor().querySelector('[aria-label="Ingredient unit"]');
    expect([...select.options].map(option => [option.value, option.textContent])).toEqual([...units, ['pc', 'pc']]);
    await change(editor().querySelector('[aria-label="Ingredient quantity"]'), '3/4');
    expect(onIngredientsChange).toHaveBeenLastCalledWith('3/4 cup rice, 2 pc carrots');
    await change(editor().querySelector('[aria-label="Ingredient unit"]'), 'bowl');
    expect(onIngredientsChange).toHaveBeenLastCalledWith('3/4 bowl rice, 2 pc carrots');
    await change(editor().querySelector('[aria-label="Ingredient name"]'), 'brown rice');
    expect(onIngredientsChange).toHaveBeenLastCalledWith('3/4 bowl brown rice, 2 pc carrots');
    await click(editor().querySelector('[aria-label="Done editing ingredient"]'));
    expect(editButton().getAttribute('aria-label')).toBe('Edit ingredient: 3/4 bowl brown rice');
    await click(container.querySelectorAll('.ingredient-chip-label')[1]);
    expect(editor().querySelector('[aria-label="Ingredient unit"]').value).toBe('pc');
    expect(onIngredientsChange).toHaveBeenCalledTimes(3);
});

test('ingredient delete still works without opening the edit control', async () => {
    await mount(<Ingredients initial="1 cup rice, 2 pc carrots" />);
    await click([...container.querySelector('.ingredient-chip').querySelectorAll('button')].find(button => button.textContent === '×'));
    expect(onIngredientsChange.mock.calls).toEqual([['2 pc carrots']]);
    expect(editor()).toBeNull();
    expect(editButton().getAttribute('aria-label')).toBe('Edit ingredient: 2 pc carrots');
});

test('meal selection is a labelled, natively focusable checkbox with the actual checked state', async () => {
    await mount(<Meal initialSelected />);
    const input = checkbox();
    expect(input).not.toBeNull();
    expect(input.getAttribute('aria-label')).toBe('Select Garden soup');
    expect(input.tabIndex).toBe(0);
    expect(input.checked).toBe(true);
    expect(input.disabled).toBe(false);
    input.focus();
    expect(document.activeElement).toBe(input);
    expect(onToggle).not.toHaveBeenCalled();
});

test('native checkbox activation toggles once with the unchanged meal ID payload', async () => {
    await mount(<Meal />);
    await click(checkbox());
    expect(checkbox().checked).toBe(true);
    expect(container.querySelector('.rustic-meal-card').classList.contains('selected')).toBe(true);
    expect(onToggle.mock.calls).toEqual([[meal._id]]);
    await click(checkbox());
    expect(checkbox().checked).toBe(false);
    expect(onToggle.mock.calls).toEqual([[meal._id], [meal._id]]);
    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
});

test('clicking the checkbox label and surrounding card each toggles once without conflicting actions', async () => {
    await mount(<Meal />);
    await click(checkbox().closest('label'));
    expect(checkbox().checked).toBe(true);
    expect(onToggle.mock.calls).toEqual([[meal._id]]);
    await click(container.querySelector('.rustic-meal-title'));
    expect(checkbox().checked).toBe(false);
    expect(onToggle.mock.calls).toEqual([[meal._id], [meal._id]]);
    expect(container.querySelector('.rustic-card-actions')).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
});

test('normal meal-card edit and delete actions retain their payloads without selecting the meal', async () => {
    await mount(<Meal selectionMode={false} />);
    expect(checkbox()).toBeNull();
    await click(container.querySelector('.rustic-meal-title'));
    await click(container.querySelector('button.edit'));
    await click(container.querySelector('button.delete'));
    expect(onEdit.mock.calls).toEqual([[meal]]);
    expect(onDelete.mock.calls).toEqual([[meal._id]]);
    expect(onToggle).not.toHaveBeenCalled();
});
