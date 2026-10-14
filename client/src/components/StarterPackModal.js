import React, { useState } from "react";
import axios from "axios";

function StarterPackModal({ isOpen, onClose, onImport, onSwitch }) {
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleImport = async () => {
        setLoading(true);
        try {
            await axios.post("http://localhost:5000/api/meals/import-starter-pack");
            onImport(); // Refresh parent state
            onClose();
            alert("Starter pack imported! 🎉");
        } catch (err) {
            console.error("Error importing starter pack:", err);
            alert("Failed to import starter pack.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header bg-success text-white">
                        <h5 className="modal-title">Welcome to Meal Planner! 🥕</h5>
                    </div>
                    <div className="modal-body text-center">
                        <p className="lead">Your meal list is looking a little empty.</p>
                        <p>Would you like to start with a <strong>Starter Pack</strong> of 20 delicious meals?</p>
                        <div className="alert alert-info">
                            Includes Avocado Toast, Chicken Curry, Tacos, and more! 🌮🥗
                        </div>
                        <hr />
                        <p>Or try our <strong>Smart Fridge Match</strong>?</p>
                        <button className="btn btn-outline-info w-100 mb-2" onClick={onSwitch}>
                            🧊 I have ingredients, suggest meals!
                        </button>
                    </div>
                    <div className="modal-footer justify-content-center">
                        <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
                            No, I'll start from scratch
                        </button>
                        <button className="btn btn-success btn-lg" onClick={handleImport} disabled={loading}>
                            {loading ? "Importing..." : "✅ Yes, Import Starter Pack!"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default StarterPackModal;
