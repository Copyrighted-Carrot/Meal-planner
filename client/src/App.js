import React, { useEffect, useContext } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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
import { UserDataProvider, useUserData } from './context/UserDataContext';
import { CarrotProvider, useCarrot } from "./context/CarrotContext";
import "./App.css";

import ApplicationShell from './components/layout/ApplicationShell';

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


function Application() {
  const { isAuthenticated } = useContext(AuthContext);
  const { meals, setMeals, draftMeal, setDraftMeal,
    showStarterModal, setShowStarterModal, showSmartModal, setShowSmartModal, refreshMeals } = useUserData();
  const handleImport = () => refreshMeals();

  return (
    <>
          <GlobalCarrotConnector openSmartFridge={() => setShowSmartModal(true)} />
          <ApplicationShell>
              {isAuthenticated && (
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
                      <GlobalMealList meals={meals} onImport={handleImport} />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/meal-planner"
                  element={
                    <PrivateRoute>
                      <MealPlanner meals={meals} />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/grocery-list"
                  element={
                    <PrivateRoute>
                      <GroceryList />
                    </PrivateRoute>
                  }
                />
              </Routes>
          </ApplicationShell>
    </>
  );
}

function SessionApplication() {
  const { sessionId, isAuthenticated } = useContext(AuthContext);
  return (
    <CarrotProvider key={isAuthenticated ? sessionId : 'public'}>
      <UserDataProvider><Application /></UserDataProvider>
    </CarrotProvider>
  );
}

function App() {
  return <AuthProvider><Router><SessionApplication /></Router></AuthProvider>;
}

export default App;
