import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from './AuthContext';
import api from '../utils/api';
import { captureSession, isCurrentSession, sessionChangedError } from '../utils/session';

const UserDataContext = createContext(null);
const emptyDraft = () => ({ name: '', ingredients: '', category: '', image: null, previewUrl: null });

// The outer key discards all private shared state on every session transition.
export function UserDataProvider({ children }) {
    const { sessionId, isAuthenticated } = useContext(AuthContext);
    return <UserDataSession key={isAuthenticated ? sessionId : 'public'}>{children}</UserDataSession>;
}

function UserDataSession({ children }) {
    const { isAuthenticated } = useContext(AuthContext);
    const session = useRef(captureSession());
    const mounted = useRef(false);
    const fetchVersion = useRef(0);
    const [meals, storeMeals] = useState([]);
    const [weeklyPlan, setWeeklyPlan] = useState([]);
    const [draftMeal, setDraftMeal] = useState(emptyDraft);
    const [showStarterModal, setShowStarterModal] = useState(false);
    const [showSmartModal, setShowSmartModal] = useState(false);
    const [mealsLoading, setMealsLoading] = useState(isAuthenticated);
    const [mealsError, setMealsError] = useState('');
    const preview = useRef(null);

    const assertSession = useCallback(() => {
        if (!mounted.current || !isCurrentSession(session.current)) throw sessionChangedError();
    }, []);
    const setMeals = useCallback(update => {
        assertSession();
        fetchVersion.current += 1;
        storeMeals(update);
        setMealsLoading(false);
        setMealsError('');
    }, [assertSession]);
    const refreshMeals = useCallback(async (offerStarter = false) => {
        assertSession();
        const version = ++fetchVersion.current;
        setMealsLoading(true);
        setMealsError('');
        try {
            const response = await api.get('/meals');
            assertSession();
            if (version !== fetchVersion.current) return;
            storeMeals(response.data);
            if (offerStarter) setShowStarterModal(response.data.length === 0);
        } catch (error) {
            if (mounted.current && isCurrentSession(session.current) && version === fetchVersion.current) setMealsError(error.message);
            throw error;
        } finally {
            if (mounted.current && isCurrentSession(session.current) && version === fetchVersion.current) setMealsLoading(false);
        }
    }, [assertSession]);

    useEffect(() => {
        mounted.current = true;
        if (isAuthenticated) refreshMeals(true).catch(() => {});
        return () => { mounted.current = false; fetchVersion.current += 1; };
    }, [isAuthenticated, refreshMeals]);

    // Image previews are private draft data too; release them on replacement/logout.
    useEffect(() => {
        const old = preview.current;
        if (old && old !== draftMeal.previewUrl && old.startsWith('blob:')) URL.revokeObjectURL(old);
        preview.current = draftMeal.previewUrl;
    }, [draftMeal.previewUrl]);
    useEffect(() => () => {
        if (preview.current?.startsWith('blob:')) URL.revokeObjectURL(preview.current);
    }, []);

    return <UserDataContext.Provider value={{
        meals, setMeals, mealsLoading, mealsError, refreshMeals, assertSession,
        weeklyPlan, setWeeklyPlan, draftMeal, setDraftMeal,
        showStarterModal, setShowStarterModal, showSmartModal, setShowSmartModal
    }}>{children}</UserDataContext.Provider>;
}

export function useUserData() {
    const value = useContext(UserDataContext);
    if (!value) throw new Error('User data must be inside the authenticated application.');
    return value;
}
