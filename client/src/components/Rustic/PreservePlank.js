import React from 'react';
import woodTexture from '../../assets/wood_texture.png';
import { CarrotIcon } from '../Icons'; // Reuse or import specific icon

const PreservePlank = ({ onClick, label = "PRESERVE RECIPE" }) => {
    return (
        <button
            type="submit"
            onClick={onClick}
            style={{
                width: '100%',
                backgroundColor: 'transparent',
                backgroundImage: `url(${woodTexture})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: 'none',
                borderRadius: '14px',
                padding: '18px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '15px',
                cursor: 'pointer',
                boxShadow: '0 6px 10px rgba(0,0,0,0.4), inset 0 2px 2px rgba(255,255,255,0.3)',
                transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                marginTop: '10px'
            }}
            onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.98) translateY(2px)';
                e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.4)';
            }}
            onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1) translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 10px rgba(0,0,0,0.4), inset 0 2px 2px rgba(255,255,255,0.3)';
            }}
        >
            {/* Icon */}
            <div style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))' }}>
                🥕 {/* Emoji or SVG */}
            </div>

            {/* Text */}
            <span style={{
                fontFamily: "'Cinzel', serif",
                fontSize: '20px',
                color: '#f3e6d0', // Light parchment
                fontWeight: 'bold',
                textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                letterSpacing: '1px'
            }}>
                {label}
            </span>
        </button>
    );
};

export default PreservePlank;
