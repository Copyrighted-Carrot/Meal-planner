import React, { useState, useEffect, useContext } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import api from "./utils/api";
import AddMeal from "./components/AddMeal";
import MealList from "./components/MealList";
import GroceryList from "./components/GroceryList";
import MealPlanner from "./components/MealPlanner";
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import PrivateRoute from "./components/routing/PrivateRoute";
import GlobalMealList from "./components/GlobalMealList";
import StarterPackModal from "./components/StarterPackModal";
import SmartImportModal from "./components/SmartImportModal";
import ShadowLogin from "./Admin/ShadowLogin";
import AdminDashboard from "./Admin/AdminDashboard";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import { CarrotProvider, useCarrot } from "./context/CarrotContext";
import "./App.css";

import { CarrotIcon, PotIcon, BookIcon, CalendarIcon, ListIcon, LogoutIcon } from "./components/Icons";

import rusticNavbarPlank from "./assets/rustic-navbar-plank.png";

// Connector Component to link App state with Carrot Context
const GlobalCarrotConnector = ({ openSmartFridge }) => {
  const { setSmartFridgeCallback } = useCarrot();
  const { isAuthenticated } = useContext(AuthContext);

  useEffect(() => {
    if (isAuthenticated) {
      setSmartFridgeCallback(() => openSmartFridge);
    } else {
      setSmartFridgeCallback(null);
    }
  }, [isAuthenticated, openSmartFridge, setSmartFridgeCallback]);

  return null;
};


function Navbar() {
  const { isAuthenticated, logout, user } = useContext(AuthContext);
  const [showStats, setShowStats] = useState(false);
  const location = useLocation();

  if (!isAuthenticated) return null;
  if (location.pathname === '/manager-access' || location.pathname === '/rustic-manager-dashboard') return null;

  const toggleStats = () => setShowStats(!showStats);
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <>
      <div style={{
        position: "fixed",
        top: 0,
        right: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "flex-end",
        paddingRight: "10px",
        zIndex: 10000,
        pointerEvents: "none"
      }}>
        <div style={{
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start", // Start from top
          gap: "20px", // Consistent spacing
          height: "100%",
          paddingTop: "40px", // Slight top padding
          paddingBottom: "10px"
        }}>
          <div className="greeting-plank" onClick={toggleStats} title="Click to see your stats!">
            {showStats ? `👨‍🍳 Chef Since ${memberSince}` : `👋 Hi, ${user && user.name}`}
          </div>

          <Link to="/" className={`sidebar-btn ${location.pathname === "/" ? "active" : ""}`}>
            <CarrotIcon />
            <span>Add Meal</span>
          </Link>
          <Link to="/available-meals" className={`sidebar-btn ${location.pathname === "/available-meals" ? "active" : ""}`}>
            <PotIcon />
            <span>Available Meals</span>
          </Link>
          <Link to="/browse" className={`sidebar-btn ${location.pathname === "/browse" ? "active" : ""}`}>
            <BookIcon />
            <span>Browse Recipes</span>
          </Link>
          <Link to="/meal-planner" className={`sidebar-btn ${location.pathname === "/meal-planner" ? "active" : ""}`}>
            <CalendarIcon />
            <span>Meal Planner</span>
          </Link>
          <Link to="/grocery-list" className={`sidebar-btn ${location.pathname === "/grocery-list" ? "active" : ""}`}>
            <ListIcon />
            <span>Grocery List</span>
          </Link>
          <button onClick={logout} className="sidebar-btn logout">
            <LogoutIcon />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}

// Canceling edit to view more lines first.
function App() {
  const [meals, setMeals] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState([]);
  const [showStarterModal, setShowStarterModal] = useState(false);
  const [showSmartModal, setShowSmartModal] = useState(false);
  // Persist AddMeal form data across navigation
  const [draftMeal, setDraftMeal] = useState({ name: "", ingredients: "", category: "", image: null, previewUrl: null });

  useEffect(() => {
    // Only fetch if authenticated (logic handled in components or check token)
    if (localStorage.getItem("token")) {
      fetchMeals();
    }
  }, []);

  async function fetchMeals() {
    try {
      // Token is automatically added by AuthContext/axios interruptor if set up correctly.
      // However, we rely on AuthContext to set the header. 
      // If we are just mounting, we rely on AuthContext to load validity.
      // Ideally, specific components should fetch their data.
      const response = await api.get("/meals");
      setMeals(response.data);
      // Check for starter pack eligibility
      if (response.data.length === 0) {
        setShowStarterModal(true);
      }
    } catch (error) {
      console.error("Error fetching meals:", error);
    }
  }

  const handleImport = () => {
    fetchMeals(); // Refresh meals after import
  };

  return (
    <AuthProvider>
      <CarrotProvider>
        <Router>
          <GlobalCarrotConnector openSmartFridge={() => setShowSmartModal(true)} />
          <div className="App">
            <Navbar />
            <div className="container mt-4">
              {localStorage.getItem("token") && (
                <>
                  <StarterPackModal
                    isOpen={showStarterModal}
                    onClose={() => setShowStarterModal(false)}
                    onImport={handleImport}
                    onSwitch={() => {
                      setShowStarterModal(false);
                      setShowSmartModal(true);
                    }}
                  />
                  <SmartImportModal
                    isOpen={showSmartModal}
                    onClose={() => setShowSmartModal(false)}
                    onImport={handleImport}
                    onBack={() => {
                      setShowSmartModal(false);
                      setShowStarterModal(true);
                    }}
                  />

                </>
              )}
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* --- SHADOW ADMIN ROUTES --- */}
                <Route path="/manager-access" element={<ShadowLogin />} />
                <Route path="/rustic-manager-dashboard" element={<AdminDashboard />} />

                <Route
                  path="/"
                  element={
                    <PrivateRoute>
                      <AddMeal
                        setMeals={setMeals}
                        onOpenSmartFridge={() => setShowSmartModal(true)}
                        draftMeal={draftMeal}
                        setDraftMeal={setDraftMeal}
                      />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/add"
                  element={
                    <PrivateRoute>
                      <AddMeal
                        setMeals={setMeals}
                        onOpenSmartFridge={() => setShowSmartModal(true)}
                        draftMeal={draftMeal}
                        setDraftMeal={setDraftMeal}
                      />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/available-meals"
                  element={
                    <PrivateRoute>
                      <MealList meals={meals} />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/browse"
                  element={
                    <PrivateRoute>
                      <GlobalMealList meals={meals} />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/meal-planner"
                  element={
                    <PrivateRoute>
                      <MealPlanner meals={meals} weeklyPlan={weeklyPlan} setWeeklyPlan={setWeeklyPlan} />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/grocery-list"
                  element={
                    <PrivateRoute>
                      <GroceryList weeklyPlan={weeklyPlan} />
                    </PrivateRoute>
                  }
                />
              </Routes>
            </div>
          </div>
        </Router>
      </CarrotProvider>
    </AuthProvider>
  );
}

export default App;
