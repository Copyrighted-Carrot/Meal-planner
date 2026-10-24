import React from 'react';

import { PotIcon } from '../Icons';

function MealListTitle() {
    return (
        <div className="rustic-title-container">
            <h1 className="rustic-title-text">
                Available Meals <span aria-hidden="true" style={{ marginLeft: '10px', flexShrink: 0 }}><PotIcon /></span>
            </h1>
        </div>
    );
}

export default MealListTitle;
