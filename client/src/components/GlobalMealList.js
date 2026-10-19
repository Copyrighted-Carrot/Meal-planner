import React, { useState, useEffect } from "react";
import api from "../utils/api";
import "./GlobalMealList.css";

function GlobalMealList({ meals: userMeals, onImport }) {
    const [globalMeals, setGlobalMeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [loadSucceeded, setLoadSucceeded] = useState(false);
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [addingId, setAddingId] = useState(null);

    useEffect(() => {
        let active = true;
        async function fetchGlobalMeals() {
            setLoading(true);
            setLoadError("");
            setLoadSucceeded(false);
            try {
                const res = await api.get("/meals/global");
                if (active) {
                    setGlobalMeals(res.data);
                    setLoadSucceeded(true);
                }
            } catch (err) {
                if (active && err.code !== 'SESSION_CHANGED' && err.statusCode !== 401) {
                    setLoadError("Could not load the recipe library. Please try again.");
                }
            } finally {
                if (active) setLoading(false);
            }
        }
        fetchGlobalMeals();
        return () => { active = false; };
    }, [loadAttempt]);

    const handleAddToMyMeals = async (mealId) => {
        setAddingId(mealId);
        try {
            await api.post(`/meals/copy/${mealId}`);
            await onImport();
            alert("Meal added to your list! 🥗");
        } catch (err) {
            if (err.code === 'SESSION_CHANGED' || err.statusCode === 401) return;
            console.error("Error copying meal:", err);
            alert("Failed to add meal.");
        } finally {
            setAddingId(null);
        }
    };

    return (
        <div className="public-meal-library mt-4">
            <h2 className="text-center mb-4">Public Meal Library 📚</h2>
            <p className="text-center text-muted">Browse and add meals to your personal collection.</p>

            {loading ? <p role="status" className="text-center">Loading Library... 📚</p> : loadError ? (
                <div role="alert" className="alert alert-danger">
                    <p>{loadError}</p>
                    <button className="btn btn-secondary" onClick={() => setLoadAttempt(attempt => attempt + 1)}>Retry</button>
                </div>
            ) : loadSucceeded ? <div className="public-meal-grid">
                {globalMeals.length === 0 ? (
                    <div className="public-meal-empty text-center">
                        <p>No global meals found. Please check back later.</p>
                    </div>
                ) : (
                    globalMeals.map((meal) => (
                        <div key={meal._id} className="public-meal-item">
                            <div className="card shadow-sm h-100">
                                <div className="card-body">
                                    <h5 className="card-title">{meal.name}</h5>
                                    <span className={`badge bg-${meal.category === 'Breakfast' ? 'warning' : meal.category === 'Lunch' ? 'success' : meal.category === 'Dinner' ? 'primary' : 'info'} mb-2`}>
                                        {meal.category}
                                    </span>
                                    <p className="card-text small">
                                        <strong>Ingredients:</strong> {Array.isArray(meal.ingredients) ? meal.ingredients.join(", ") : meal.ingredients}
                                    </p>
                                    <button
                                        className="btn btn-outline-primary w-100 mt-2"
                                        onClick={() => handleAddToMyMeals(meal._id)}
                                        disabled={addingId === meal._id}
                                    >
                                        {addingId === meal._id ? "Adding..." : "➕ Add to My Meals"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div> : null}
        </div>
    );
}

export default GlobalMealList;
