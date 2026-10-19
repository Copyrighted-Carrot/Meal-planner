import React, { useEffect, useRef, useState } from "react";
import api from '../utils/api';
import useDialogFocus from '../hooks/useDialogFocus';
import './UserDialogs.css';

function SmartImportModal({ isOpen, onClose, onImport, onBack }) {
    const [ingredients, setIngredients] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [addingId, setAddingId] = useState(null);
    const [searched, setSearched] = useState(false);
    const [suggestionError, setSuggestionError] = useState("");
    const [importError, setImportError] = useState(null);
    const [addedIds, setAddedIds] = useState([]);
    const [notice, setNotice] = useState("");
    const importing = useRef(false);
    const copiedIds = useRef(new Set());
    const dialogRef = useDialogFocus(isOpen, onClose);

    useEffect(() => {
        if (isOpen) {
            setAddedIds([]);
            setNotice("");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSuggest = async () => {
        if (!ingredients.trim() || loading || importing.current) return;
        setLoading(true);
        setSearched(false);
        setSuggestionError("");
        try {
            const res = await api.post("/meals/suggest", { ingredients });
            setSuggestions(res.data);
            setSearched(true);
        } catch (err) {
            if (err.code === 'SESSION_CHANGED' || err.statusCode === 401) return;
            setSuggestionError("Could not find recipes. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (mealId) => {
        if (importing.current || addedIds.includes(mealId)) return;
        importing.current = true;
        setAddingId(mealId);
        setImportError(null);
        setNotice("");
        try {
            if (!copiedIds.current.has(mealId)) {
                await api.post(`/meals/copy/${mealId}`);
                copiedIds.current.add(mealId);
            }
            await onImport(); // Refresh the current user's shared meals.
            copiedIds.current.delete(mealId);
            setAddedIds(ids => [...ids, mealId]);
            setNotice("Meal added to your list! 🥗");
        } catch (err) {
            if (err.code === 'SESSION_CHANGED' || err.statusCode === 401) return;
            setImportError({ mealId, message: copiedIds.current.has(mealId)
                ? "Meal added, but your collection could not be refreshed. Retry to reload your meals."
                : "Could not add this meal. Please try again." });
        } finally {
            importing.current = false;
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
                        {suggestionError && <div role="alert" className="alert alert-danger">
                            <p>{suggestionError}</p>
                            <button className="btn btn-secondary" onClick={handleSuggest} disabled={loading}>Retry</button>
                        </div>}
                        {importError && <div role="alert" className="alert alert-danger">
                            <p>{importError.message}</p>
                            <button className="btn btn-secondary" onClick={() => handleAdd(importError.mealId)} disabled={addingId !== null}>Retry</button>
                        </div>}
                        {addingId !== null && <p role="status">Adding meal and refreshing your collection...</p>}
                        {notice && <p role="status" className="alert alert-success">{notice}</p>}
                        {!suggestions.length && !loading && (
                            <div className="text-center">
                                {searched && <p role="status">No recipes matched these ingredients. Try a different combination.</p>}
                                <p>What ingredients do you have? 🍳</p>
                                <textarea
                                    className="form-control mb-3"
                                    rows="3"
                                    placeholder="e.g. eggs, milk, spinach, chicken..."
                                    value={ingredients}
                                    onChange={(e) => {
                                        setIngredients(e.target.value);
                                        setSearched(false);
                                        setSuggestionError("");
                                    }}
                                />
                                <button className="btn btn-primary" onClick={handleSuggest} disabled={!ingredients.trim()}>
                                    🔍 Find Recipes
                                </button>
                            </div>
                        )}

                        {loading && <div role="status" className="text-center py-4">Checking the recipe book... 📖</div>}

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
                                                disabled={addingId !== null || addedIds.includes(meal._id)}
                                            >
                                                {addingId === meal._id ? "Adding..." : addedIds.includes(meal._id) ? "Added" : copiedIds.current.has(meal._id) ? "Refresh meals" : "Add"}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-center mt-4">
                                    <button className="btn btn-outline-secondary" disabled={addingId !== null} onClick={() => {
                                        setSuggestions([]);
                                        setSearched(false);
                                        setImportError(null);
                                        setNotice("");
                                    }}>Try Different Ingredients</button>
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
