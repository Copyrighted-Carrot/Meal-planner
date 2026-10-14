import React from 'react';
import scrollImage from '../../assets/rustic-final-scroll.png';

const PlateIcon = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#5d4037', marginLeft: '10px' }}>
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="16"></line>
        <line x1="8" y1="12" x2="16" y2="12"></line>
    </svg>
);

function MealListTitle() {
    return (
        <div className="rustic-title-container">
            <h1 className="rustic-title-text">
                Meal List <PlateIcon />
            </h1>
        </div>
    );
}

export default MealListTitle;
