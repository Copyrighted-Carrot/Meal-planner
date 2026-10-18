import React, { useState } from "react";
import api from '../utils/api';
import useDialogFocus from '../hooks/useDialogFocus';
import './UserDialogs.css';

function SmartImportModal({ isOpen, onClose, onImport, onBack }) {
    const [ingredients, setIngredients] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [addingId, setAddingId] = useState(null);
    const dialogRef = useDialogFocus(isOpen, onClose);

    if (!isOpen) return null;

    const handleSuggest = async () => {
        if (!ingredients.trim()) return;
        setLoading(true);
        try {
            const res = await api.post("/meals/suggest", { ingredients });
            setSuggestions(res.data);
        } catch (err) {
            if (err.code === 'SESSION_CHANGED' || err.statusCode === 401) return;
            console.error("Error fetching suggestions:", err);
            alert("Failed to find suggestions.");
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (mealId) => {
        setAddingId(mealId);
        try {
            await api.post(`/meals/copy/${mealId}`);
            await onImport(); // Refresh the current user's shared meals.
            alert("Meal added! 🥗");
        } catch (err) {
            if (err.code === 'SESSION_CHANGED' || err.statusCode === 401) return;
            console.error("Error adding meal:", err);
        } finally {
            setAddingId(null);
        }
    };

    return (
        <div ref={dialogRef} className="modal show d-block user-dialog" role="dialog" aria-modal="true" aria-labelledby="smart-fridge-title" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content">
                    <div className="modal-header bg-info text-white">
                        <h5 className="modal-title" id="smart-fridge-title">Smart Fridge Match 🧊</h5>
                        <button type="button" className="btn-close" aria-label="Close Smart Fridge" onClick={onClose}></button>
                    </div>
                    <div className="modal-body">
                        {!suggestions.length && !loading && (
                            <div className="text-center">
                                <p>What ingredients do you have? 🍳</p>
                                <textarea
                                    className="form-control mb-3"
                                    rows="3"
                                    placeholder="e.g. eggs, milk, spinach, chicken..."
                                    value={ingredients}
                                    onChange={(e) => setIngredients(e.target.value)}
                                />
                                <button className="btn btn-primary" onClick={handleSuggest} disabled={!ingredients.trim()}>
                                    🔍 Find Recipes
                                </button>
                            </div>
                        )}

                        {loading && <div className="text-center py-4">Checking the recipe book... 📖</div>}

                        {suggestions.length > 0 && (
                            <div>
                                <h5>Top Matches:</h5>
                                <div className="list-group">
                                    {suggestions.map((meal) => (
                                        <div key={meal._id} className="list-group-item d-flex justify-content-between align-items-center user-dialog-suggestion">
                                            <div className="user-dialog-suggestion-text">
                                                <strong>{meal.name}</strong> <br />
                                                <small className="text-muted">{meal.ingredients.join(", ")}</small>
                                            </div>
                                            <button
                                                className="btn btn-sm btn-success"
                                                onClick={() => handleAdd(meal._id)}
                                                disabled={addingId === meal._id}
                                            >
                                                {addingId === meal._id ? "Added" : "Add"}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-center mt-4">
                                    <button className="btn btn-outline-secondary" onClick={() => setSuggestions([])}>Try Different Ingredients</button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        {onBack && <button className="btn btn-link" onClick={onBack}>Back to Starter Pack</button>}
                        <button className="btn btn-secondary" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SmartImportModal;
