import React, { useState, useEffect } from "react";
import api from "../utils/api";
import "./GlobalMealList.css";

function GlobalMealList({ meals: userMeals, onImport }) {
    const [globalMeals, setGlobalMeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addingId, setAddingId] = useState(null);

    useEffect(() => {
        async function fetchGlobalMeals() {
            try {
                const res = await api.get("/meals/global");
                setGlobalMeals(res.data);
            } catch (err) {
                console.error("Error fetching global meals:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchGlobalMeals();
    }, []);

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

    if (loading) return <div className="text-center mt-4">Loading Library... 📚</div>;

    return (
        <div className="public-meal-library mt-4">
            <h2 className="text-center mb-4">Public Meal Library 📚</h2>
            <p className="text-center text-muted">Browse and add meals to your personal collection.</p>

            <div className="public-meal-grid">
                {globalMeals.length === 0 ? (
                    <div className="public-meal-empty text-center">
                        <p>No global meals found. Be the first to publish one!</p>
                        {/* Optional: Add a button to publish if the backend supports it, 
                            but for now just showing empty state message */}
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
            </div>
        </div>
    );
}

export default GlobalMealList;
