import { useEffect, useRef } from 'react';

const controls = 'button, a[href], input, select, textarea, [tabindex], [contenteditable="true"]';

function focusableControls(dialog) {
    return [...dialog.querySelectorAll(controls)].filter(element => {
        if (element.tabIndex < 0 || element.matches(':disabled, input[type="hidden"]')) return false;
        for (let current = element; current; current = current.parentElement) {
            const style = window.getComputedStyle(current);
            if (current.hidden || current.hasAttribute('inert') || current.getAttribute('aria-hidden') === 'true'
                || style.display === 'none' || style.visibility === 'hidden') return false;
            if (current === dialog) break;
        }
        return true;
    });
}

/** Keep keyboard focus inside an open dialog without resetting it on ordinary rerenders. */
export default function useDialogFocus(open, onDismiss) {
    const dialogRef = useRef(null);
    const dismissRef = useRef(onDismiss);
    dismissRef.current = onDismiss;

    useEffect(() => {
        if (!open || !dialogRef.current) return undefined;
        const dialog = dialogRef.current;
        const trigger = document.activeElement;
        const focusFirst = () => (focusableControls(dialog)[0] || dialog).focus();
        focusFirst();

        const handleKeyDown = event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                dismissRef.current?.();
                return;
            }
            if (event.key !== 'Tab') return;
            const available = focusableControls(dialog);
            const first = available[0];
            const last = available[available.length - 1];
            const active = document.activeElement;
            if (!first) {
                event.preventDefault();
                dialog.focus();
            } else if (!dialog.contains(active) || active === dialog) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
            } else if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            if (trigger?.isConnected && typeof trigger.focus === 'function') trigger.focus();
        };
    }, [open]);

    return dialogRef;
}
