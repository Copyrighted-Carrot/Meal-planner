import React from "react";
import api from '../utils/api';

function MealItem({ meal, setMeals }) {
  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this meal?")) {
      try {
        await api.delete(`/meals/${meal._id}`);
        setMeals((prevMeals) => prevMeals.filter((m) => m._id !== meal._id));
      } catch (error) {
        console.error("Error deleting meal:", error);
      }
    }
  };

  return (
    <div className="col-md-4">
      <div className="card shadow-sm p-3 border-0 rounded">
        <h5 className="fw-bold text-primary">{meal.name}</h5>
        <p className="small"><strong>Category:</strong> {meal.category}</p>
        <p className="small"><strong>Ingredients:</strong> {meal.ingredients.join(", ")}</p>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>
          ❌ Delete Meal
        </button>
      </div>
    </div>
  );
}

export default MealItem;
