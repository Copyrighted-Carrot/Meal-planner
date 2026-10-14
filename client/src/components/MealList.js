import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import MealCard from "./Rustic/MealCard";
import MealListTitle from "./Rustic/MealListTitle";
import "./MealList.css";

function MealList() {
  const [meals, setMeals] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchMeals() {
      try {
        const response = await axios.get("http://localhost:5000/api/meals", {
          headers: { 'x-auth-token': localStorage.getItem('token') }
        });
        setMeals(response.data);
      } catch (error) {
        console.error("Error fetching meals:", error);
      }
    }
    fetchMeals();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this meal?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/meals/${id}`, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      setMeals(meals.filter((meal) => meal._id !== id));
    } catch (error) {
      console.error("Error deleting meal:", error);
      alert("Failed to delete meal");
    }
  };

  const handleEdit = (meal) => {
    navigate('/add', { state: { mealToEdit: meal } });
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
        await axios.delete(`http://localhost:5000/api/meals/${id}`, {
          headers: { 'x-auth-token': localStorage.getItem('token') }
        });
      }

      // Update local state
      setMeals(meals.filter(m => !selectedIds.has(m._id)));
      setIsSelectionMode(false);
      setSelectedIds(new Set());

    } catch (error) {
      console.error("Bulk delete error:", error);
      alert("Some meals could not be deleted.");
      // Refresh simply
      window.location.reload();
    }
  };

  return (
    <div className="rustic-page-container">
      {/* Background Layer handled in CSS via .rustic-page-container */}

      <MealListTitle />

      {/* Control Bar */}
      <div style={{ maxWidth: '1400px', margin: '0 auto 20px', display: 'flex', justifyContent: 'flex-end', padding: '0 20px', gap: '10px' }}>
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
      </div>

      {meals.length === 0 ? (
        <div className="text-center mt-5" style={{ color: '#5d4037', fontSize: '1.5rem', fontWeight: 'bold' }}>
          <p>No meals found. Start cooking! 🥕</p>
        </div>
      ) : (
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
