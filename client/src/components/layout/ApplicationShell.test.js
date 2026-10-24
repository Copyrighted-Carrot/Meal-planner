import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import ApplicationShell from './ApplicationShell';

jest.mock('react-router/dom', () => jest.requireActual('react-router/dist/development/dom-export.js'), { virtual: true });
jest.mock('react-router-dom', () => jest.requireActual('react-router-dom/dist/index.js'), { virtual: true });

let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const mount = async (route = '/', authenticated = true, logout = jest.fn()) => act(async () => root.render(
  <AuthContext.Provider value={{ isAuthenticated: authenticated, user: { name: 'Kitchen Preview', createdAt: '2024-01-01' }, logout }}>
    <MemoryRouter initialEntries={[route]}><ApplicationShell><h1>Recipe page</h1></ApplicationShell></MemoryRouter>
  </AuthContext.Provider>
));

test('menu disclosure opens, Escape closes it and returns focus to the toggle', async () => {
  await mount();
  const toggle = container.querySelector('[aria-controls]');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  await act(async () => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  const link = container.querySelector('a[href="/meal-planner"]');
  link.focus();
  await act(async () => link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(toggle);
});

test('navigation preserves all destinations and closes after choosing a route', async () => {
  await mount('/add');
  expect(container.querySelector('a[aria-current="page"]').textContent).toBe('Add Meal');
  expect([...container.querySelectorAll('nav a')].map(link => link.getAttribute('href'))).toEqual(['/', '/available-meals', '/browse', '/meal-planner', '/grocery-list']);
  const toggle = container.querySelector('[aria-controls]');
  await act(async () => toggle.click());
  await act(async () => container.querySelector('a[href="/meal-planner"]').click());
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(container.querySelector('a[aria-current="page"]').textContent).toBe('Meal Planner');
});

test.each([
  ['/', '/'],
  ['/add', '/'],
  ['/available-meals', '/available-meals'],
  ['/browse', '/browse'],
  ['/meal-planner', '/meal-planner'],
  ['/grocery-list', '/grocery-list'],
  ['/meal-planner?view=week#planner-heading', '/meal-planner'],
  [{ pathname: '/add', state: { mealId: 'fixture-edit-meal' } }, '/'],
])('direct entry %j marks only the existing destination %s as current', async (entry, href) => {
  await mount(entry);
  const current = [...container.querySelectorAll('nav a[aria-current="page"]')];
  expect(current).toHaveLength(1);
  expect(current[0].getAttribute('href')).toBe(href);
  expect([...container.querySelectorAll('nav a.active')]).toEqual(current);
  expect(container.querySelectorAll('nav a:not([aria-current])')).toHaveLength(4);
});

test.each(['/available-meals/fixture', '/browse/fixture'])('unmatched nested path %s does not invent a parent active destination', async route => {
  await mount(route);
  expect(container.querySelector('nav a[aria-current]')).toBeNull();
  expect(container.querySelector('nav a.active')).toBeNull();
});

test('logout still invokes the existing session action', async () => {
  const logout = jest.fn(); await mount('/', true, logout);
  await act(async () => container.querySelector('.logout').click());
  expect(logout).toHaveBeenCalledTimes(1);
});

test.each(['/login', '/register'])('public form %s never overlaps authenticated navigation', async route => {
  await mount(route);
  expect(container.querySelector('nav')).toBeNull();
  expect(container.querySelector('main')).not.toBeNull();
});

test('manager routes retain their separate container without user navigation', async () => {
  await mount('/rustic-manager-dashboard');
  expect(container.querySelector('.app-shell')).toBeNull();
  expect(container.querySelector('.App > .container')).not.toBeNull();
});
