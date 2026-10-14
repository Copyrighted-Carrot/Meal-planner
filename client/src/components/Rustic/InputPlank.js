import React from 'react';
import plankBg from '../../assets/rustic-plank-ui.png';

const InputPlank = ({
    label,
    value,
    onChange,
    name,
    type = "text",
    placeholder,
    icon: Icon,
    isTextarea = false,
    onClick, // For file upload button behavior
    readOnly = false
}) => {
    // Plank Container Style
    const plankStyle = {
        position: 'relative',
        width: '100%',
        backgroundImage: `url(${plankBg})`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        borderRadius: '0', // The image has the rounded shape
        filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.5))', // External shadow only
        padding: '18px 50px', // Generous padding so text doesn't hit the ornate ends
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.1s ease',
        border: 'none',
        backgroundColor: 'transparent'
    };

    // Input Field Style (Embedded & Large)
    const fieldStyle = {
        background: 'transparent',
        border: 'none',
        borderRadius: '0',
        padding: '0',
        color: '#ffddc1', // Warm beige text
        fontSize: '1.4rem', // Large game text
        fontWeight: 'bold',
        width: '100%',
        outline: 'none',
        boxShadow: 'none',
        resize: 'none',
        fontFamily: "'Nunito', sans-serif", // Changed to Nunito
        textShadow: '0 2px 3px rgba(0,0,0,0.8)',
        height: '100%', // Fill height
        lineHeight: '1.5',
    };

    // Placeholder styling injection (via style tag for simplicity in inline-styles)
    // Note: Inline styles can't target ::placeholder. We rely on the font being robust.

    // Icon Container
    const iconStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0
    };

    const handlePlankClick = (e) => {
        if (onClick) onClick(e);
    };

    return (
        <div style={plankStyle} onClick={handlePlankClick} className="rustic-plank">
            {/* Inject Scoped Scrollbar Styles */}
            <style>{`
                .rustic-scroll::-webkit-scrollbar {
                    width: 8px;
                }
                .rustic-scroll::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.05); 
                    border-radius: 4px;
                    margin: 2px 0;
                }
                .rustic-scroll::-webkit-scrollbar-thumb {
                    background: #5c4033; /* Dark Wood */
                    border-radius: 4px;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .rustic-scroll::-webkit-scrollbar-thumb:hover {
                    background: #8b5e3c;
                }
                .rustic-scroll::-webkit-scrollbar-button {
                    display: none !important;
                    height: 0;
                    width: 0;
                }
            `}</style>

            {/* Left Icon (if provided) */}
            {Icon && (
                <div style={iconStyle}>
                    <Icon style={{ width: '28px', height: '28px', fill: '#ffcc99', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.6))' }} />
                </div>
            )}

            {/* Direct Input (No Label Wrapper) */}
            {isTextarea ? (
                <textarea
                    className="rustic-scroll"
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder || label}
                    style={{
                        ...fieldStyle,
                        minHeight: '40px',
                        maxHeight: '60px', // Strict limit to keep inside the single-plank look
                        paddingTop: '4px',
                        paddingBottom: '4px',
                        resize: 'none',
                        overflowY: 'auto',
                        lineHeight: '1.2'
                    }}
                    readOnly={readOnly}
                />
            ) : (
                <input
                    type={type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder || label}
                    style={fieldStyle}
                    readOnly={readOnly}
                    autoComplete="off"
                />
            )}


        </div>
    );
};

export default InputPlank;
