import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import MealCard from './Rustic/MealCard';

const meal = {
    _id: 'presentation-meal',
    name: 'Roasted garden vegetables with chickpeas, fresh herbs and lemon dressing',
    category: 'Dinner',
    ingredients: ['1/2 cup chickpeas', '2 carrots', 'fresh herbs to taste'],
    nutrition: { calories: 123, protein: 8, carbs: 16, fat: 4 },
};
const cloudinaryImage = 'https://res.cloudinary.com/fixture/image/upload/v123/vegetables.jpg';
let container, root;

async function renderMeal(overrides = {}) {
    await act(async () => root.render(
        <MealCard meal={{ ...meal, ...overrides }} selectionMode={false}
            onEdit={jest.fn()} onDelete={jest.fn()} onToggle={jest.fn()} />
    ));
}

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
});

test('long recipe names and existing comparison metadata remain complete', async () => {
    await renderMeal();
    expect(container.querySelector('h3').textContent).toBe(meal.name);
    expect(container.querySelector('.rustic-meal-category').textContent).toBe('Category: Dinner');
    expect([...container.querySelectorAll('.rustic-badge')].map(badge => badge.textContent.trim()))
        .toEqual(['123 kcal', '8g P', '16g C', '4g F']);
    expect([...container.querySelectorAll('.rustic-card-actions button')].map(button => button.textContent.trim()))
        .toEqual(['Edit', 'Delete']);
});

test.each([
    ['array', meal.ingredients, '1/2 cup chickpeas, 2 carrots, fresh herbs to taste'],
    ['string', '1/2 cup chickpeas, 2 carrots; fresh herbs to taste', '1/2 cup chickpeas, 2 carrots; fresh herbs to taste'],
])('%s ingredients retain all original quantities and wording', async (_kind, ingredients, expected) => {
    await renderMeal({ ingredients });
    expect(container.querySelector('.rustic-ingredients').textContent).toBe(`Ingredients: ${expected}`);
});

test('a valid Cloudinary crop preserves the existing rounded transformation and image name', async () => {
    await renderMeal({
        imageUrl: cloudinaryImage,
        imageCrop: { x: 10.4, y: 20.6, width: 300.2, height: 200.8 },
    });
    const photo = container.querySelector('.rustic-meal-photo');
    expect(photo.getAttribute('alt')).toBe(meal.name);
    expect(photo.getAttribute('src')).toBe(
        'https://res.cloudinary.com/fixture/image/upload/c_crop,x_10,y_21,w_300,h_201/v123/vegetables.jpg'
    );
    expect(container.querySelector('.rustic-image-container').classList.contains('is-placeholder')).toBe(false);
    expect(container.querySelector('.rustic-no-image')).toBeNull();
});

test('non-Cloudinary photos retain their original URL even when crop metadata exists', async () => {
    const imageUrl = 'https://images.example.invalid/vegetables.jpg';
    await renderMeal({ imageUrl, imageCrop: { x: 10, y: 20, width: 300, height: 200 } });
    expect(container.querySelector('.rustic-meal-photo').getAttribute('src')).toBe(imageUrl);
    expect(container.querySelector('.rustic-image-container').classList.contains('is-placeholder')).toBe(false);
});

test.each([
    ['absent', undefined],
    ['zero width', { x: 10, y: 20, width: 0, height: 200 }],
    ['negative height', { x: 10, y: 20, width: 300, height: -1 }],
    ['missing height', { x: 10, y: 20, width: 300 }],
])('%s crop metadata leaves the original photo URL unchanged', async (_description, imageCrop) => {
    await renderMeal({ imageUrl: cloudinaryImage, imageCrop });
    expect(container.querySelector('.rustic-meal-photo').getAttribute('src')).toBe(cloudinaryImage);
    expect(container.querySelector('.rustic-no-image')).toBeNull();
});

test.each([undefined, ''])('a missing photo uses the compact placeholder without hiding recipe details', async imageUrl => {
    await renderMeal({ imageUrl });
    expect(container.querySelector('.rustic-image-container').classList.contains('is-placeholder')).toBe(true);
    expect(container.querySelector('.rustic-no-image').textContent).toBe('No image added');
    expect(container.querySelector('.rustic-meal-photo')).toBeNull();
    expect(container.querySelector('h3').textContent).toBe(meal.name);
    expect(container.querySelector('.rustic-ingredients').textContent).toBe(`Ingredients: ${meal.ingredients.join(', ')}`);
});
