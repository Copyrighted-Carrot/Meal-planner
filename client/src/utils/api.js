import axios from 'axios';
import { resolveApiBaseUrl } from './apiConfig';
import { captureSession, isCurrentSession, setSessionToken, sessionChangedError } from './session';

const baseURL = resolveApiBaseUrl();
const api = axios.create({ baseURL });
// Manager authentication stays separate; it shares only the configured address.
export const adminApi = axios.create({ baseURL });

api.interceptors.request.use(config => {
    if (!/^\/(?!\/)/.test(config.url || '') || config.baseURL !== baseURL) {
        throw new Error('Application API requests must use the configured API address.');
    }
    config.session = captureSession();
    config.skipAuth = config.skipAuth === true || /^\/auth\/(?:login|register|google)$/.test(config.url);
    config.headers.delete('x-auth-token');
    if (!config.skipAuth && config.session.token) config.headers.set('x-auth-token', config.session.token);
    return config;
});

api.interceptors.response.use(response => {
    if (!response.config.skipAuth && !isCurrentSession(response.config.session)) throw sessionChangedError();
    return response;
}, error => {
    const config = error.config;
    if (config?.session && !config.skipAuth && !isCurrentSession(config.session)) return Promise.reject(sessionChangedError());
    // Never retain Axios request/response objects: they can contain credentials.
    const body = error.response?.data;
    const rateLimitMessage = error.response?.status === 429 && typeof body === 'string' ? body : null;
    const failure = new Error(body?.message || body?.msg || rateLimitMessage || (axios.isCancel(error) ? 'Request cancelled.' : 'Unable to complete the request. Please try again.'));
    failure.statusCode = error.response?.status;
    failure.code = axios.isCancel(error) ? 'REQUEST_CANCELLED' : 'API_ERROR';
    if (config?.session && !config.skipAuth && failure.statusCode === 401 && isCurrentSession(config.session)) setSessionToken(null);
    return Promise.reject(failure);
});

export default api;
