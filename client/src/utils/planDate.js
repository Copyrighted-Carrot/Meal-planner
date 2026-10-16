// Calendar dates stay in the user's local calendar, without UTC/DST shifts.
export function weekForDate(value = new Date()) {
    if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose a valid date.');
    const date = typeof value === 'string' ? new Date(`${value}T12:00:00`) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('Choose a valid date.');
    if (typeof value === 'string' && (date.getFullYear() !== Number(value.slice(0, 4)) ||
        date.getMonth() + 1 !== Number(value.slice(5, 7)) || date.getDate() !== Number(value.slice(8, 10)))) throw new Error('Choose a valid date.');
    date.setDate(date.getDate() - (date.getDay() + 6) % 7);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const PLAN_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const PLAN_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];

export function planReferences(plan) {
    return plan.map(day => ({ day: day.day, ...Object.fromEntries(PLAN_SLOTS.map(slot => {
        const meal = day[slot];
        if (meal && !meal._id) throw new Error('A selected meal has no saved ID. Refresh your meals before saving.');
        return [slot, meal?._id || null];
    })) }));
}
