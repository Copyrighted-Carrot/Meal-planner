import React from 'react';
import scrollBg from '../../assets/rustic-final-scroll.png';

const ParchmentContainer = ({ children, title, sidePanel }) => (
    <section className="recipe-parchment" style={{ backgroundImage: `url(${scrollBg})` }}>
        <h1 className="recipe-parchment-title">{title}</h1>
        <div className="recipe-parchment-layout">
            <div className="recipe-parchment-content">{children}</div>
            {sidePanel && <aside className="recipe-parchment-side">{sidePanel}</aside>}
        </div>
    </section>
);

export default ParchmentContainer;
