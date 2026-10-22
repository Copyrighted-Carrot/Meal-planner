import React, { useState } from "react";
import api from '../utils/api';
import { useUserData } from '../context/UserDataContext';
import { Link, useNavigate } from "react-router-dom";
import MealCard from "./Rustic/MealCard";
import MealListTitle from "./Rustic/MealListTitle";
import "./MealList.css";

function MealList() {
  const { meals, setMeals, mealsLoading, mealsError, refreshMeals, assertSession } = useUserData();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const navigate = useNavigate();

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this meal?")) return;
    try {
      await api.delete(`/meals/${id}`);
      assertSession();
      setMeals(current => current.filter((meal) => meal._id !== id));
    } catch (error) {
      if (error.code === 'SESSION_CHANGED' || error.statusCode === 401) return;
      console.error("Error deleting meal:", error);
      alert("Failed to delete meal");
    }
  };

  const handleEdit = (meal) => {
    navigate('/add', { state: { mealId: meal._id } });
  };

  // --- Bulk Selection Logic ---
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === meals.length) {
      setSelectedIds(new Set()); // Deselect all
    } else {
      const allIds = new Set(meals.map(m => m._id));
      setSelectedIds(allIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} meals?`)) return;

    try {
      // Sequentially delete (could be parallelized but safer sequential for rate limits)
      for (const id of selectedIds) {
        assertSession();
        await api.delete(`/meals/${id}`);
      }

      // Update local state
      assertSession();
      setMeals(current => current.filter(m => !selectedIds.has(m._id)));
      setIsSelectionMode(false);
      setSelectedIds(new Set());

    } catch (error) {
      if (error.code === 'SESSION_CHANGED' || error.statusCode === 401) return;
      console.error("Bulk delete error:", error);
      alert("Some meals could not be deleted.");
      // Refresh simply
      refreshMeals().catch(() => {});
    }
  };

  return (
    <div className="rustic-page-container">
      {/* Background Layer handled in CSS via .rustic-page-container */}

      <MealListTitle />

      {/* Control Bar */}
      {meals.length > 0 && <div className="rustic-meal-controls">
        {!isSelectionMode ? (
          <button className="btn btn-outline-dark" style={{ fontWeight: 'bold' }} onClick={toggleSelectionMode}>
            ✨ Select Multiple
          </button>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={handleSelectAll}>
              {selectedIds.size === meals.length ? "Deselect All" : "Select All"}
            </button>
            <button className="btn btn-danger" disabled={selectedIds.size === 0} onClick={handleBulkDelete}>
              Delete Selected ({selectedIds.size})
            </button>
            <button className="btn btn-light" onClick={toggleSelectionMode}>
              Cancel
            </button>
          </>
        )}
      </div>}

      {mealsLoading && <div role="status" className="alert alert-info page-state">
        <p className="page-state-title">{meals.length ? 'Refreshing your meals...' : 'Loading your meals...'}</p>
        <p>{meals.length ? 'Your current collection is shown below while it refreshes.' : 'Checking your saved recipes. Your collection will appear here.'}</p>
      </div>}
      {mealsError && <div role="alert" className="alert alert-danger page-state">
        <p className="page-state-title">Your meal collection could not be loaded.</p>
        <p className="page-state-detail">{mealsError}</p>
        {meals.length > 0 && <p>Your previously loaded meals are still shown below.</p>}
        <div className="page-state-actions"><button className="btn btn-secondary" onClick={() => refreshMeals().catch(() => {})}>Retry</button></div>
      </div>}
      {!mealsLoading && !mealsError && meals.length === 0 && (
        <div className="alert page-state page-state-empty">
          <p className="page-state-title">No meals saved yet.</p>
          <p>Add your first recipe or browse the library to start your collection.</p>
          <div className="page-state-actions">
            <Link className="btn btn-primary" to="/add">Add Meal</Link>
            <Link className="btn btn-secondary" to="/browse">Browse Recipes</Link>
          </div>
        </div>
      )}
      {meals.length > 0 && (
        <div className="rustic-meal-grid">
          {meals.map((meal) => (
            <MealCard
              key={meal._id}
              meal={meal}
              onEdit={handleEdit}
              onDelete={handleDelete}
              selectionMode={isSelectionMode}
              isSelected={selectedIds.has(meal._id)}
              onToggle={toggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MealList;
