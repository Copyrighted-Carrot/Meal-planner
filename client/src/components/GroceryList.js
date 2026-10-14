import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { parseIngredient } from "../utils/ingredientParser";

function GroceryList({ weeklyPlan }) {
  const [savedList, setSavedList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Load latest list from server on mount
  useEffect(() => {
    fetchLatestList();
  }, []);

  const fetchLatestList = async () => {
    setLoading(true);
    try {
      const res = await api.get("/grocery");
      if (res.data && res.data.length > 0) {
        setSavedList(res.data[0]); // Get most recent list
      }
    } catch (err) {
      console.error("Error fetching grocery list:", err);
      // Don't show error to user immediately, just fallback to empty
    } finally {
      setLoading(false);
    }
  };

  const calculateItemsFromPlan = () => {
    if (!weeklyPlan || weeklyPlan.length === 0) return [];

    const aggMap = new Map();

    // Helper: Normalize Weight to Grams
    const toGrams = (qty, unit) => {
      const q = parseFloat(qty) || 0;
      switch (unit) {
        case 'g': case 'gm': case 'grams': return q;
        case 'kg': case 'kilo': return q * 1000;
        case 'lb': case 'pound': return q * 453.592;
        case 'oz': case 'ounce': return q * 28.3495;
        default: return 0;
      }
    };

    // Helper: Normalize Volume to ML
    const toMl = (qty, unit) => {
      const q = parseFloat(qty) || 0;
      switch (unit) {
        case 'ml': return q;
        case 'l': case 'liter': case 'litre': return q * 1000;
        case 'cup': return q * 240;
        case 'tbsp': case 'tablespoon': return q * 15;
        case 'tsp': case 'teaspoon': return q * 5;
        default: return 0;
      }
    };

    const isWeight = (u) => ['g', 'gm', 'grams', 'kg', 'kilo', 'lb', 'pound', 'oz', 'ounce'].includes(u);
    const isVolume = (u) => ['ml', 'l', 'liter', 'litre', 'cup', 'tbsp', 'tablespoon', 'tsp', 'teaspoon'].includes(u);

    weeklyPlan.forEach((dayPlan) => {
      ["breakfast", "lunch", "dinner"].forEach((mealType) => {
        const meal = dayPlan[mealType];
        if (meal && meal.ingredients) {
          // Handle both string array and comma-separated string
          const list = Array.isArray(meal.ingredients)
            ? meal.ingredients
            : (typeof meal.ingredients === 'string' ? meal.ingredients.split(',') : []);

          list.forEach((rawIng) => {
            const parsed = parseIngredient(rawIng);
            if (!parsed) return;

            const key = parsed.name.toLowerCase();
            if (!aggMap.has(key)) {
              aggMap.set(key, {
                name: parsed.name, // Keep one casing display
                weightG: 0,
                volumeMl: 0,
                counts: {} // Map of unit -> total
              });
            }
            const entry = aggMap.get(key);

            if (isWeight(parsed.unit)) {
              entry.weightG += toGrams(parsed.qty, parsed.unit);
            } else if (isVolume(parsed.unit)) {
              entry.volumeMl += toMl(parsed.qty, parsed.unit);
            } else {
              // Count or other unit (bunch, packet, x)
              const u = parsed.unit === 'x' ? 'count' : parsed.unit;
              entry.counts[u] = (entry.counts[u] || 0) + parseFloat(parsed.qty);
            }
          });
        }
      });
    });

    // Format final strings
    return Array.from(aggMap.values()).map(entry => {
      const parts = [];

      // Format Weight
      if (entry.weightG > 0) {
        if (entry.weightG >= 1000) {
          parts.push(`${parseFloat((entry.weightG / 1000).toFixed(2))} kg`);
        } else {
          parts.push(`${Math.round(entry.weightG)} g`);
        }
      }

      // Format Volume
      if (entry.volumeMl > 0) {
        if (entry.volumeMl >= 1000) {
          parts.push(`${parseFloat((entry.volumeMl / 1000).toFixed(2))} L`);
        } else {
          parts.push(`${Math.round(entry.volumeMl)} ml`);
        }
      }

      // Format Counts
      Object.entries(entry.counts).forEach(([unit, count]) => {
        if (unit === 'count') {
          parts.push(count > 1 ? `x${count}` : `x${count}`); // or empty string if just 1? Keep x for clarity implies simple count
        } else {
          parts.push(`${count} ${unit}${count > 1 ? 's' : ''}`); // pluralize crudely
        }
      });

      // Fallback for empty (shouldn't happen if parsed correctly)
      if (parts.length === 0) parts.push('x1');

      return {
        name: `${entry.name}: ${parts.join(' + ')}`,
        amount: "", // Deprecated/Unused in simple string model but kept for schema compatibility
        checked: false
      };
    });
  };

  const handleGenerateList = async () => {
    const items = calculateItemsFromPlan();
    if (items.length === 0) return alert("No items in plan to generate from!");

    setLoading(true);
    try {
      const res = await api.post("/grocery", { items });
      setSavedList(res.data);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to save list");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = async (index) => {
    if (!savedList) return;

    const newItems = [...savedList.items];
    newItems[index].checked = !newItems[index].checked;

    // Optimistic update
    setSavedList({ ...savedList, items: newItems });

    try {
      // Send full update to backend
      await api.put(`/grocery/${savedList._id}`, { items: newItems });
    } catch (err) {
      console.error("Failed to update item:", err);
      setError("Failed to sync changes");
      // Revert on failure? For now, keep simple.
    }
  };

  const handleDeleteList = async () => {
    if (!savedList || !window.confirm("Are you sure you want to delete this list?")) return;

    try {
      await api.delete(`/grocery/${savedList._id}`);
      setSavedList(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // Determine which items to show
  // If savedList exists, use its items. Otherwise empty.
  const displayItems = savedList ? savedList.items : [];

  const filteredList = displayItems.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  // Export Helpers
  const getExportData = () => filteredList.map(item => `${item.checked ? '[x]' : '[ ]'} ${item.name}`);

  // ... (Export functions reused but updated to use getExportData) ...
  const exportCSV = () => {
    const data = getExportData();
    if (data.length === 0) return alert("Nothing to export!");
    const csvContent = "data:text/csv;charset=utf-8," + "Grocery List\n" + data.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "grocery_list.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  // (Assuming other exports similar, keeping brief for this edit or could re-include full code if preferred. 
  // I will include full code to be safe).

  const exportPDF = async () => {
    const data = getExportData();
    if (data.length === 0) return alert("Nothing to export!");
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("My Grocery List 🛒", 20, 20);
    doc.setFontSize(12);
    let y = 30;
    data.forEach((item, index) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(`${index + 1}. ${item}`, 20, y);
      y += 10;
    });
    doc.save("grocery_list.pdf");
  };

  const shareWhatsApp = () => {
    const data = getExportData();
    if (data.length === 0) return alert("Nothing to export!");
    const text = `*My Grocery List* 🛒\n\n${data.join("\n")}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Grocery List 🛒</h2>
        {savedList && (
          <button className="btn btn-danger btn-sm" onClick={handleDeleteList}>Delete List</button>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Persistence Controls */}
      <div className="card p-3 mb-4 bg-white shadow-sm">
        {savedList ? (
          <div className="d-flex justify-content-between align-items-center">
            <span className="text-secondary">Using Saved List ({new Date(savedList.createdAt).toLocaleDateString()})</span>
            {weeklyPlan.length > 0 && (
              <button className="btn btn-warning btn-sm" onClick={handleGenerateList}>
                🔄 Regenerate from Current Plan
              </button>
            )}
          </div>
        ) : (
          <div className="text-center">
            <p className="mb-2">No active list found.</p>
            {weeklyPlan.length > 0 ? (
              <button className="btn btn-success" onClick={handleGenerateList} disabled={loading}>
                {loading ? "Generating..." : "✨ Generate List from Weekly Plan"}
              </button>
            ) : (
              <p className="text-muted">Create a meal plan first to generate a list.</p>
            )}
          </div>
        )}
      </div>

      {/* Main List UI (Only if list exists) */}
      {savedList && (
        <>
          {/* Export Actions */}
          <div className="card p-2 bg-light mb-3">
            <div className="d-flex gap-2 justify-content-center">
              <button className="btn btn-outline-primary btn-sm" onClick={exportCSV}>📄 CSV</button>
              <button className="btn btn-outline-danger btn-sm" onClick={exportPDF}>📕 PDF</button>
              <button className="btn btn-outline-success btn-sm" onClick={shareWhatsApp}>💬 WhatsApp</button>
            </div>
          </div>

          {/* Search Bar */}
          <input
            type="text"
            className="form-control mb-3"
            placeholder="Search ingredients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {filteredList.length === 0 ? (
            <p>No ingredients found.</p>
          ) : (
            <ul className="list-group">
              {filteredList.slice(0, showAll ? filteredList.length : 5).map((item, index) => (
                <li
                  key={index}
                  className={`list-group-item d-flex justify-content-between align-items-center ${item.checked ? 'bg-light text-decoration-line-through text-muted' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleToggleItem(index)}
                >
                  <span>{item.name}</span>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => { }} // handled by li click
                    className="form-check-input"
                  />
                </li>
              ))}
            </ul>
          )}

          {/* Show More / Show Less Button */}
          {filteredList.length > 5 && (
            <button className="btn btn-secondary mt-3" onClick={() => setShowAll(!showAll)}>
              {showAll ? "▲ Show Less" : "▼ Show More"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default GroceryList;
