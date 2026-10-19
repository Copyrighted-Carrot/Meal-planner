import React, { useRef, useState } from "react";
import api from '../utils/api';
import useDialogFocus from '../hooks/useDialogFocus';
import './UserDialogs.css';

function StarterPackModal({ isOpen, onClose, onImport, onSwitch }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const importing = useRef(false);
    const imported = useRef(false);
    const dialogRef = useDialogFocus(isOpen, loading ? undefined : onClose);

    if (!isOpen) return null;

    const handleImport = async () => {
        if (importing.current) return;
        importing.current = true;
        setLoading(true);
        setError("");
        try {
            if (!imported.current) {
                await api.post("/meals/import-starter-pack");
                imported.current = true;
            }
            await onImport(); // Refresh the current user's shared meals before closing.
            imported.current = false;
            onClose();
            alert("Starter pack imported! 🎉");
        } catch (err) {
            if (err.code === 'SESSION_CHANGED' || err.statusCode === 401) return;
            setError(imported.current
                ? "Starter pack imported, but your collection could not be refreshed. Retry to reload your meals."
                : "Could not import the starter pack. Please try again.");
        } finally {
            importing.current = false;
            setLoading(false);
        }
    };

    return (
        <div ref={dialogRef} className="modal show d-block user-dialog" role="dialog" aria-modal="true" aria-labelledby="starter-pack-title" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header bg-success text-white">
                        <h5 className="modal-title" id="starter-pack-title">Welcome to Meal Planner! 🥕</h5>
                    </div>
                    <div className="modal-body text-center">
                        {loading && <p role="status">Importing your starter pack and refreshing your meals...</p>}
                        {error && <div role="alert" className="alert alert-danger">
                            <p>{error}</p>
                            <button className="btn btn-secondary" onClick={handleImport} disabled={loading}>Retry</button>
                        </div>}
                        <p className="lead">Your meal list is looking a little empty.</p>
                        <p>Would you like to start with a <strong>Starter Pack</strong> of 20 delicious meals?</p>
                        <div className="alert alert-info">
                            Includes Avocado Toast, Chicken Curry, Tacos, and more! 🌮🥗
                        </div>
                        <hr />
                        <p>Or try our <strong>Smart Fridge Match</strong>?</p>
                        <button className="btn btn-outline-info w-100 mb-2" onClick={onSwitch} disabled={loading}>
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
