import React from 'react';

const ParchmentHeader = ({ title }) => {
    return (
        <div style={{
            position: 'relative',
            width: '100%',
            height: '80px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '20px',
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))'
        }}>
            {/* SVG Scroll Backplate */}
            <svg width="300" height="70" viewBox="0 0 300 70" style={{ position: 'absolute', top: 0 }}>
                <defs>
                    <linearGradient id="scrollGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#e3d2b2" />
                        <stop offset="50%" stopColor="#f0e6d2" />
                        <stop offset="100%" stopColor="#d4c5a3" />
                    </linearGradient>
                </defs>
                {/* Main Body */}
                <path d="M20,10 H280 Q290,10 290,20 V50 Q290,60 280,60 H20 Q10,60 10,50 V20 Q10,10 20,10 Z" fill="url(#scrollGrad)" />
                {/* Left Curl */}
                <path d="M10,20 Q0,20 0,10 Q0,0 10,0 H30 Q20,10 20,20 V50 Q20,60 10,60 Z" fill="#c4b28d" />
                {/* Right Curl */}
                <path d="M290,20 Q300,20 300,10 Q300,0 290,0 H270 Q280,10 280,20 V50 Q280,60 290,60 Z" fill="#c4b28d" />
            </svg>

            {/* Title Text */}
            <h2 style={{
                position: 'relative',
                zIndex: 2,
                fontFamily: "'Cinzel', serif",
                color: '#3b2a1a',
                fontSize: '24px',
                margin: 0,
                fontWeight: 'bold',
                textShadow: '0 1px 0 rgba(255,255,255,0.4)'
            }}>
                {title}
            </h2>
        </div>
    );
};

export default ParchmentHeader;
