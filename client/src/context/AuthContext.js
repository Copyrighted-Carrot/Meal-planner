import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import api from '../utils/api';
import { captureSession, isCurrentSession, setSessionToken, subscribeSession, sessionChangedError } from '../utils/session';

export const AuthContext = createContext({ isAuthenticated: false, loading: true, user: null });

export function AuthProvider({ children }) {
    const [session, setSession] = useState(captureSession);
    const [identity, setIdentity] = useState(null);
    const attempt = useRef(0);

    useEffect(() => {
        const unsubscribe = subscribeSession(next => { setIdentity(null); setSession(next); });
        setSession(current => isCurrentSession(current) ? current : captureSession());
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!session.token) return;
        const controller = new AbortController();
        let active = true;
        api.get('/auth/user', { signal: controller.signal }).then(response => {
            if (!active || !isCurrentSession(session)) return;
            const user = response.data;
            if (!user || typeof (user.id || user._id) !== 'string') throw new Error('Invalid account response');
            setIdentity({ session, user });
        }).catch(() => {
            if (active && isCurrentSession(session)) setSessionToken(null);
        });
        return () => { active = false; controller.abort(); };
    }, [session]);

    const logout = useCallback(() => {
        attempt.current += 1;
        setSessionToken(null);
    }, []);

    const authenticate = useCallback(async (path, data) => {
        const currentAttempt = ++attempt.current;
        setSessionToken(null);
        const started = captureSession();
        const response = await api.post(path, data, { skipAuth: true });
        if (attempt.current !== currentAttempt || !isCurrentSession(started)) throw sessionChangedError();
        if (typeof response.data?.token !== 'string' || !response.data.token) throw new Error('Sign-in did not return a session.');
        setSessionToken(response.data.token);
    }, []);

    const user = identity && isCurrentSession(identity.session) ? identity.user : null;
    const token = session.token;
    const isAuthenticated = Boolean(user);
    const loading = Boolean(token && !user);
    const sessionId = String(session.revision) + ':' + (user?.id || user?._id || (token ? 'pending' : 'guest'));

    useEffect(() => {
        if (!isAuthenticated) return;
        let timeout;
        const resetTimer = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                logout();
                alert('Session Expired. Please log in again.');
            }, 60 * 60 * 1000);
        };
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
        resetTimer();
        events.forEach(event => document.addEventListener(event, resetTimer));
        return () => {
            clearTimeout(timeout);
            events.forEach(event => document.removeEventListener(event, resetTimer));
        };
    }, [isAuthenticated, sessionId, logout]);

    return <AuthContext.Provider value={{
        token, user, isAuthenticated, loading, sessionId,
        login: data => authenticate('/auth/login', data),
        register: data => authenticate('/auth/register', data),
        googleLogin: credential => authenticate('/auth/google', { credential }),
        logout
    }}>{children}</AuthContext.Provider>;
}
