import React, { useRef, useState } from "react";
import api from '../utils/api';
import useDialogFocus from '../hooks/useDialogFocus';
import './UserDialogs.css';

function StarterPackModal({ isOpen, onClose, onImport, onSwitch }) {
    const [pendingStage, setPendingStage] = useState(null);
    const loading = pendingStage !== null;
    const [error, setError] = useState("");
    const importing = useRef(false);
    const imported = useRef(false);
    const handleClose = () => { if (!importing.current) onClose?.(); };
    const handleSwitch = () => { if (!importing.current) onSwitch?.(); };
    const dialogRef = useDialogFocus(isOpen, handleClose);

    if (!isOpen) return null;

    const handleImport = async () => {
        if (importing.current) return;
        importing.current = true;
        setPendingStage(imported.current ? 'refresh' : 'import');
        setError("");
        try {
            if (!imported.current) {
                await api.post("/meals/import-starter-pack");
                imported.current = true;
            }
            setPendingStage('refresh');
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
            setPendingStage(null);
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
                        {loading && <div role="status" className="alert alert-info page-state text-start">
                            <p className="page-state-title">{pendingStage === 'refresh' ? 'Refreshing your meals...' : 'Importing your starter pack...'}</p>
                            <p>{pendingStage === 'refresh' ? 'Your starter pack was added. Please wait while your collection reloads.' : 'Please wait while the starter meals are added to your collection.'}</p>
                        </div>}
                        {error && <div role="alert" className="alert alert-danger page-state text-start">
                            <p className="page-state-title">Starter pack needs attention.</p>
                            <p className="page-state-detail">{error}</p>
                            <div className="page-state-actions"><button className="btn btn-secondary" onClick={handleImport} disabled={loading}>Retry</button></div>
                        </div>}
                        <p className="lead">Your meal list is looking a little empty.</p>
                        <p>Would you like to start with a <strong>Starter Pack</strong> of 20 delicious meals?</p>
                        <div className="alert alert-info">
                            Includes Avocado Toast, Chicken Curry, Tacos, and more! 🌮🥗
                        </div>
                        <hr />
                        <p>Or try our <strong>Smart Fridge Match</strong>?</p>
                        <button className="btn btn-outline-info w-100 mb-2" onClick={handleSwitch} disabled={loading}>
                            🧊 I have ingredients, suggest meals!
                        </button>
                    </div>
                    <div className="modal-footer justify-content-center">
                        <button className="btn btn-secondary" onClick={handleClose} disabled={loading}>
                            No, I'll start from scratch
                        </button>
                        <button className="btn btn-success btn-lg" onClick={handleImport} disabled={loading}>
                            {loading ? (pendingStage === 'refresh' ? "Refreshing..." : "Importing...") : imported.current ? "Refresh meals" : "✅ Yes, Import Starter Pack!"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default StarterPackModal;
