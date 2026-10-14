import React, { useState, useEffect } from "react";
import api from "../utils/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function MealPlanner({ meals, weeklyPlan, setWeeklyPlan }) {
  // Removed local state to fix persistence issue. Using props instead.

  useEffect(() => {
    // Only load from server if we don't have a plan yet (session persistence)
    if (weeklyPlan.length === 0) {
      async function loadPlan() {
        try {
          const res = await api.get("/plan");
          if (res.data && res.data.length > 0) {
            setWeeklyPlan(res.data);
          }
        } catch (err) {
          console.error("Error loading plan:", err);
        }
      }
      loadPlan();
    }
  }, [setWeeklyPlan, weeklyPlan.length]);

  const generateMealPlan = async () => {
    if (meals.length === 0) {
      setWeeklyPlan([]);  // Update global state
      return;
    }

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const newPlan = days.map((day) => ({
      day,
      breakfast: getRandomMeal("Breakfast"),
      lunch: getRandomMeal("Lunch"),
      dinner: getRandomMeal("Dinner"),
      snack: getRandomMeal("Snack"),
    }));

    setWeeklyPlan(newPlan); // Update Global State immediately

    // Save to server
    try {
      await api.post("/plan", { plan: newPlan });
    } catch (err) {
      console.error("Error saving plan:", err);
    }
  };

  const getRandomMeal = (category) => {
    const filteredMeals = meals.filter((meal) => meal.category === category);
    return filteredMeals.length > 0 ? filteredMeals[Math.floor(Math.random() * filteredMeals.length)] : null;
  };

  // Helper: Format Plan for Export
  const getPlanSummary = () => {
    return weeklyPlan.map(d => {
      const meals = [
        `Breakfast: ${d.breakfast ? d.breakfast.name : '-'}`,
        `Lunch: ${d.lunch ? d.lunch.name : '-'}`,
        `Snack: ${d.snack ? d.snack.name : '-'}`,
        `Dinner: ${d.dinner ? d.dinner.name : '-'}`
      ].join('\n  ');
      return `*${d.day}*\n  ${meals}`;
    }).join('\n\n');
  };

  // Export Plan CSV
  const exportPlanCSV = () => {
    if (weeklyPlan.length === 0) return alert("No plan to export!");
    const headers = "Day,Breakfast,Lunch,Snack,Dinner\n";
    const rows = weeklyPlan.map(d =>
      `${d.day},"${d.breakfast?.name || '-'}","${d.lunch?.name || '-'}","${d.snack?.name || '-'}","${d.dinner?.name || '-'}"`
    ).join("\n");

    const csvContent = "data:text/csv;charset=utf-8," + headers + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "weekly_meal_plan.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Plan PDF
  const exportPlanPDF = async () => {
    if (weeklyPlan.length === 0) return alert("No plan to export!");

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Weekly Meal Plan 📅", 14, 20);

    const tableColumn = ["Day", "Breakfast", "Lunch", "Snack", "Dinner"];
    const tableRows = weeklyPlan.map(d => [
      d.day,
      d.breakfast ? d.breakfast.name : '-',
      d.lunch ? d.lunch.name : '-',
      d.snack ? d.snack.name : '-',
      d.dinner ? d.dinner.name : '-'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [40, 167, 69] }, // bootstrap success green
      styles: { fontSize: 10, cellPadding: 3 },
    });

    doc.save("weekly_meal_plan.pdf");
  };

  // Share Plan WhatsApp
  const sharePlanWhatsApp = () => {
    if (weeklyPlan.length === 0) return alert("No plan to export!");
    const text = `*📅 Weekly Meal Plan*\n\n${getPlanSummary()}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };


  return (
    <div className="container mt-4">
      <h2>Weekly Meal Plan 📅</h2>
      {weeklyPlan.length === 0 ? (
        <p>No meals available. Add some meals first!</p>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Breakfast</th>
                <th>Lunch</th>
                <th>Snack</th>
                <th>Dinner</th>
              </tr>
            </thead>
            <tbody>
              {weeklyPlan.map((dayPlan) => {
                // Calculate Daily Calories
                const meals = [dayPlan.breakfast, dayPlan.lunch, dayPlan.snack, dayPlan.dinner];
                const totalCals = meals.reduce((sum, m) => sum + (m?.nutrition?.calories || 0), 0);
                const progress = Math.min((totalCals / 2000) * 100, 100);

                return (
                  <tr key={dayPlan.day}>
                    <td>
                      <strong>{dayPlan.day}</strong>
                      <div className="mt-1" style={{ fontSize: '0.8rem' }}>
                        🔥 {totalCals} kcal
                        <div className="progress mt-1" style={{ height: '6px' }}>
                          <div
                            className={`progress-bar ${totalCals > 2000 ? 'bg-danger' : 'bg-success'}`}
                            role="progressbar"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td>{dayPlan.breakfast ? dayPlan.breakfast.name : "-"}</td>
                    <td>{dayPlan.lunch ? dayPlan.lunch.name : "-"}</td>
                    <td>{dayPlan.snack ? dayPlan.snack.name : "-"}</td>
                    <td>{dayPlan.dinner ? dayPlan.dinner.name : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Share Plan Actions */}
          <div className="card mt-4 p-3 bg-light">
            <h4>Share Meal Plan 📅</h4>
            <div className="d-flex gap-2 mt-2">
              <button className="btn btn-outline-primary" onClick={exportPlanCSV}>📄 Export CSV</button>
              <button className="btn btn-outline-danger" onClick={exportPlanPDF}>📕 Export PDF</button>
              <button className="btn btn-outline-success" onClick={sharePlanWhatsApp}>💬 Share on WhatsApp</button>
            </div>
          </div>
        </>
      )}
      <button className="btn btn-success btn-lg mt-3 mb-5" onClick={generateMealPlan}>
        🔄 Generate New Plan
      </button>
    </div>
  );
}

export default MealPlanner;
