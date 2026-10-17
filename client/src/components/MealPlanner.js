import React, { useEffect } from "react";
import { useUserData } from "../context/UserDataContext";
import { PLAN_DAYS } from "../utils/planDate";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function MealPlanner({ meals }) {
  const { weeklyPlan, weekStart, selectWeek, planRecord, loadPlan, savePlan, mealsLoading, mealsError } = useUserData();
  const busy = planRecord.loading || planRecord.saving;

  useEffect(() => { loadPlan(); }, [weekStart, loadPlan]);

  const generateMealPlan = async () => {
    if (!meals.length || busy || !planRecord.loaded) return;
    const newPlan = PLAN_DAYS.map((day) => ({
      day,
      breakfast: getRandomMeal("Breakfast"),
      lunch: getRandomMeal("Lunch"),
      dinner: getRandomMeal("Dinner"),
      snack: getRandomMeal("Snack"),
    }));

    try {
      await savePlan(newPlan);
    } catch (_) { /* Shared state displays the save error. */ }
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
      <label htmlFor="plan-week">Week beginning Monday</label>
      <input id="plan-week" type="date" className="form-control mb-2" value={weekStart} disabled={planRecord.saving}
        onChange={event => { if (event.target.value) selectWeek(event.target.value); }} />
      {planRecord.loading && <p role="status">Loading this week's plan...</p>}
      {planRecord.saving && <p role="status">Saving this week's plan...</p>}
      {planRecord.notice && <p role="status" className="text-success">{planRecord.notice}</p>}
      {(planRecord.error || mealsError) && <div role="alert" className="alert alert-danger">{planRecord.error || mealsError}</div>}
      {planRecord.error && <button className="btn btn-secondary mb-2" disabled={busy} onClick={() => loadPlan(true)}>Reload this week</button>}
      {planRecord.legacyPlan?.length > 0 && <div className="alert alert-info">
        An older undated plan is available. It has not been assigned to this week.
        <button className="btn btn-secondary ms-2" disabled={busy || !planRecord.loaded}
          onClick={() => savePlan(planRecord.legacyPlan).catch(() => {})}>Copy older plan to this week</button>
      </div>}
      <h2>Weekly Meal Plan 📅</h2>
      {weeklyPlan.length === 0 ? (
        <p>{meals.length ? 'No saved plan for this week. Generate one below.' : 'No meals available. Add some meals first!'}</p>
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
                return (
                  <tr key={dayPlan.day}>
                    <td>
                      <strong>{dayPlan.day}</strong>
                      <div className="mt-1" style={{ fontSize: '0.8rem' }}>Nutrition unknown: portions are not verified.</div>
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
      <button className="btn btn-success btn-lg mt-3 mb-5" onClick={generateMealPlan}
        disabled={busy || !planRecord.loaded || mealsLoading || !meals.length}>
        🔄 Generate New Plan
      </button>
    </div>
  );
}

export default MealPlanner;
