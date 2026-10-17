import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import api from '../utils/api';
import { planReferences, weekForDate } from '../utils/planDate';
import { captureSession, isCurrentSession, sessionChangedError } from '../utils/session';

const emptyWeek = weekStart => ({ weekStart, _id: null, revision: 0, plan: [], legacyPlan: null,
    loaded: false, loading: false, saving: false, error: '', notice: '' });

const selectedWeek = accountId => {
    try {
        const saved = accountId && sessionStorage.getItem(`meal-planner:week:${accountId}`);
        if (saved) return weekForDate(saved);
    } catch (_) { /* Invalid preferences or unavailable storage must not block plans. */ }
    return weekForDate();
};

export default function useWeeklyPlan(accountId) {
    const [state, setState] = useState(() => emptyWeek(selectedWeek(accountId)));
    const current = useRef(state);
    const generation = useRef(0);
    const mounted = useRef(false);
    const session = useRef(captureSession());
    const update = useCallback(next => { current.current = next; setState(next); }, []);
    const active = useCallback(() => mounted.current && isCurrentSession(session.current), []);
    useLayoutEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            generation.current += 1;
            current.current = { ...current.current, loading: false, saving: false };
        };
    }, []);

    const selectWeek = useCallback(value => {
        if (!active()) throw sessionChangedError();
        const weekStart = weekForDate(value);
        if (weekStart === current.current.weekStart) return;
        try {
            if (accountId) sessionStorage.setItem(`meal-planner:week:${accountId}`, weekStart);
        } catch (_) { /* The selected week still works when browser storage is disabled. */ }
        generation.current += 1;
        update(emptyWeek(weekStart));
    }, [accountId, active, update]);

    const loadPlan = useCallback(async (force = false) => {
        if (!active()) throw sessionChangedError();
        const before = current.current;
        if (before.saving || before.loading || (before.loaded && !force)) return;
        const version = ++generation.current;
        update({ ...before, loading: true, error: '', notice: '' });
        try {
            const { data } = await api.get('/plan', { params: { weekStart: before.weekStart } });
            if (!active() || version !== generation.current) return;
            if (data.weekStart !== before.weekStart || !Array.isArray(data.plan)) throw new Error('The server returned a different week. Please reload.');
            update({ ...emptyWeek(before.weekStart), ...data, loaded: true });
        } catch (error) {
            if (active() && version === generation.current) update({ ...before, loaded: false, loading: false, error: error.message });
        }
    }, [active, update]);

    const savePlan = useCallback(async plan => {
        if (!active()) throw sessionChangedError();
        const before = current.current;
        if (!before.loaded || before.loading || before.saving) throw new Error('Wait for this week to finish loading or saving.');
        const version = ++generation.current;
        update({ ...before, saving: true, error: '', notice: '' });
        try {
            const { data } = await api.post('/plan', {
                weekStart: before.weekStart, revision: before.revision, plan: planReferences(plan)
            });
            if (!active() || version !== generation.current) return;
            if (data.weekStart !== before.weekStart) throw new Error('The server returned a different week. Please reload.');
            update({ ...emptyWeek(before.weekStart), ...data, loaded: true, notice: 'Plan saved.' });
            return data;
        } catch (error) {
            if (active() && version === generation.current) update({ ...before, saving: false,
                loaded: error.statusCode === 409 ? false : before.loaded,
                error: error.statusCode === 409 ? 'This week changed in another session. Reload it before saving again.' : `Plan was not saved. ${error.message}` });
            throw error;
        }
    }, [active, update]);

    // Shared state remains session-scoped, including callers holding an old setter.
    const setWeeklyPlan = useCallback(value => {
        if (!active()) throw sessionChangedError();
        generation.current += 1;
        update({ ...current.current, plan: typeof value === 'function' ? value(current.current.plan) : value });
    }, [active, update]);

    return { weeklyPlan: state.plan, setWeeklyPlan, weekStart: state.weekStart, selectWeek,
        planRecord: state, loadPlan, savePlan };
}
