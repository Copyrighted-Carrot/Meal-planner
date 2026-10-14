// A revision separates even two logins that happen to return the same token.
let revision = 0;
const listeners = new Set();
export const captureSession = () => ({ token: localStorage.getItem('token'), revision });
export const isCurrentSession = session => session.token === localStorage.getItem('token') && session.revision === revision;

export function setSessionToken(token) {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
    revision += 1;
    listeners.forEach(listener => listener(captureSession()));
}
export function subscribeSession(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
window.addEventListener('storage', event => {
    if (event.storageArea === localStorage && (event.key === 'token' || event.key === null)) {
        revision += 1;
        listeners.forEach(listener => listener(captureSession()));
    }
});
export function sessionChangedError() {
    const error = new Error('The active session changed. Please try again.');
    error.code = 'SESSION_CHANGED';
    return error;
}
