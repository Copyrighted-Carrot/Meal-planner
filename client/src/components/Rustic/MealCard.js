import React from 'react';
import frameImage from '../../assets/rustic-card-frame.png';

// --- Inline SVG Icons (Placeholders until assets provided) ---
const PlateIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#5d4037' }}>
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="16"></line>
        <line x1="8" y1="12" x2="16" y2="12"></line>
    </svg>
);

const CalorieIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#e74c3c' }}>
        <path d="M12 2C12 2 8 8 8 12C8 16.4 11.6 20 16 20C17.7 20 19.3 19.5 20.7 18.6C20 18.8 19.3 19 18.5 19C14.4 19 11 15.6 11 11.5C11 9.5 11.8 7.7 13.1 6.4C12.7 6.3 12.3 6.3 12 6.3V2Z" />
        <path d="M7.8 12.5C7.3 11 7 9.4 7 7.7C7 6.4 7.3 5.3 7.7 4.2C5.5 5.6 4 8.1 4 11C4 12.3 4.3 13.5 4.9 14.6C5.5 13.6 6.5 12.9 7.8 12.5Z" />
    </svg>
);

const ProteinIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#3498db' }}>
        <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM7 10.82C5.84 10.4 5 9.3 5 8V7h2v3.82zM19 10.82c-.84 1.25-2.05 2.05-3.32 2.2C15.22 13.08 15 13.1 15 13.5v.5h-6v-.5c0-.4.22-.42.32-.48C8.05 12.87 6.84 12.07 6 10.82V7h12v3.82z" />
    </svg>
);

const CarbsIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#f1c40f' }}>
        <path d="M12 2L4 5v14l8 3 8-3V5l-8-3zm6 15.5l-6 2.25-6-2.25V6.5l6-2.25 6 2.25v11z" />
        <path d="M10 8h4v8h-4z" opacity="0.5" />
    </svg>
);

const FatIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#27ae60' }}>
        <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const EditIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5d4037" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
);

const DeleteIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
);


function MealCard({ meal, onEdit, onDelete, selectionMode, isSelected, onToggle }) {
    // Safe accessor for nutrition
    const nutrition = meal.nutrition || {};

    // Helper to constructing Cloudinary URL with crop parameters
    const getCroppedImageUrl = (url, crop) => {
        if (!url || !crop || !url.includes('cloudinary.com')) return url;
        if (!crop.width || !crop.height || crop.width <= 0 || crop.height <= 0) return url;

        // Insert transformation parameters after /upload/
        // Format: /upload/x_10,y_20,w_300,h_200,c_crop/v12345678/image.jpg
        const cropParams = `c_crop,x_${Math.round(crop.x)},y_${Math.round(crop.y)},w_${Math.round(crop.width)},h_${Math.round(crop.height)}`;
        return url.replace('/upload/', `/upload/${cropParams}/`);
    };

    const hasValidCrop = meal.imageCrop && meal.imageCrop.width > 0 && meal.imageCrop.height > 0;
    const displayImageUrl = hasValidCrop ? getCroppedImageUrl(meal.imageUrl, meal.imageCrop) : meal.imageUrl;


    return (
        <div
            className={`rustic-meal-card ${isSelected ? 'selected' : ''}`}
            onClick={() => selectionMode && onToggle && onToggle(meal._id)}
            style={{ cursor: selectionMode ? 'pointer' : 'default' }}
        >
            {/* Selection Checkbox */}
            {selectionMode && (
                <label className="rustic-selection-overlay" onClick={(event) => event.stopPropagation()}>
                    <input
                        className="rustic-checkbox"
                        type="checkbox"
                        aria-label={`Select ${meal.name}`}
                        checked={Boolean(isSelected)}
                        onChange={() => onToggle && onToggle(meal._id)}
                    />
                </label>
            )}

            {/* Frame Background */}
            <img src={frameImage} alt="Frame" className="rustic-card-frame-image" />

            {/* Content Container (Absoluted inside frame) */}
            <div className="rustic-card-content">

                {/* Image Frame Area */}
                <div className="rustic-image-container">
                    {displayImageUrl ? (
                        <img src={displayImageUrl} alt={meal.name} className="rustic-meal-photo" />
                    ) : (
                        <div className="rustic-no-image">
                            <PlateIcon />
                            <span>No image added</span>
                        </div>
                    )}
                </div>

                {/* Title & Info */}
                <h3 className="rustic-meal-title">{meal.name}</h3>
                <div className="rustic-meal-category">Category: {meal.category}</div>

                {/* Nutrition Badges */}
                <div className="rustic-nutrition-row">
                    <div className="rustic-badge red" title="Calories">
                        <CalorieIcon /> {nutrition.calories || 0} kcal
                    </div>
                    <div className="rustic-badge blue" title="Protein">
                        <ProteinIcon /> {nutrition.protein || 0}g P
                    </div>
                    <div className="rustic-badge yellow" title="Carbs">
                        <CarbsIcon /> {nutrition.carbs || 0}g C
                    </div>
                    <div className="rustic-badge green" title="Fat">
                        <FatIcon /> {nutrition.fat || 0}g F
                    </div>
                </div>

                {/* Ingredients (Text limit?) */}
                <div className="rustic-ingredients">
                    <strong>Ingredients:</strong> {
                        Array.isArray(meal.ingredients) ? meal.ingredients.join(', ') : meal.ingredients
                    }
                </div>

                {/* Action Buttons (Disabled or Hidden in Selection Mode?) */}
                {!selectionMode && (
                    <div className="rustic-card-actions">
                        <button className="rustic-btn-small edit" onClick={(e) => { e.stopPropagation(); onEdit(meal); }}>
                            <EditIcon /> Edit
                        </button>
                        <button className="rustic-btn-small delete" onClick={(e) => { e.stopPropagation(); onDelete(meal._id); }}>
                            <DeleteIcon /> Delete
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}

export default MealCard;
