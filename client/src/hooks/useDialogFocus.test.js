import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import useDialogFocus from './useDialogFocus';

let container, root, trigger;
function Dialog({ open = true, onDismiss, empty = false }) {
    const ref = useDialogFocus(open, onDismiss);
    if (!open) return null;
    return <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1}>
        {!empty && <>
            <button disabled>Disabled</button>
            <button hidden>Hidden</button>
            <div style={{ display: 'none' }}><button>Hidden by parent</button></div>
            <button data-control="first">First</button>
            <input aria-label="Middle" />
            <button data-control="last">Last</button>
        </>}
    </div>;
}
const render = async props => act(async () => root.render(<Dialog {...props} />));
const key = (name, shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true });
    act(() => document.activeElement.dispatchEvent(event));
    return event;
};
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    trigger = document.createElement('button');
    trigger.textContent = 'Open dialog';
    document.body.appendChild(trigger);
    trigger.focus();
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    trigger.remove();
});

test('focuses the first enabled visible control and wraps Tab in both directions', async () => {
    await render({});
    const first = container.querySelector('[data-control="first"]');
    const last = container.querySelector('[data-control="last"]');
    expect(document.activeElement).toBe(first);
    expect(key('Tab', true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    expect(key('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    container.querySelector('input').focus();
    expect(key('Tab').defaultPrevented).toBe(false);
    // Native traversal handles controls between the first and last.
});

test('Escape uses the latest dismiss callback without refocusing on a rerender', async () => {
    const previous = jest.fn(), latest = jest.fn();
    await render({ onDismiss: previous });
    const input = container.querySelector('input');
    input.focus();
    await render({ onDismiss: latest });
    expect(document.activeElement).toBe(input);
    expect(key('Escape').defaultPrevented).toBe(true);
    expect(previous).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
});

test('closing restores the connected trigger and removes the keyboard trap', async () => {
    const dismiss = jest.fn();
    await render({ onDismiss: dismiss });
    await render({ open: false, onDismiss: dismiss });
    expect(document.activeElement).toBe(trigger);
    expect(key('Tab').defaultPrevented).toBe(false);
    key('Escape');
    expect(dismiss).not.toHaveBeenCalled();
});

test('a dialog with no available controls receives and retains keyboard focus', async () => {
    await render({ empty: true });
    const dialog = container.querySelector('[role="dialog"]');
    expect(document.activeElement).toBe(dialog);
    expect(key('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog);
    expect(key('Tab', true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog);
});

test('Tab returns stray focus to the dialog and cleanup tolerates a removed trigger', async () => {
    await render({});
    trigger.focus();
    expect(key('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(container.querySelector('[data-control="first"]'));
    trigger.remove();
    await render({ open: false });
    expect(document.activeElement).toBe(document.body);
});
