export function resolveApiBaseUrl(value = process.env.REACT_APP_API_BASE_URL) {
    const baseURL = (value || '/api').trim().replace(/\/+$/, '');
    if (/^\/(?!\/)/.test(baseURL)) return baseURL;
    try {
        const parsed = new URL(baseURL);
        if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password && !parsed.search && !parsed.hash) return baseURL;
    } catch { /* Report invalid configuration without printing its contents. */ }
    throw new Error('REACT_APP_API_BASE_URL must be an API path or an HTTP(S) URL without credentials.');
}
