import React from 'react';
import woodTexture from '../../assets/rustic-wheel-texture.png';
import imgBreakfast from '../../assets/wheel-breakfast.png';
import imgLunch from '../../assets/wheel-lunch.png';
import imgDinner from '../../assets/wheel-dinner.png';
import imgSnack from '../../assets/wheel-snack.png';

const OccasionWheel = ({ selected, onSelect }) => {
    // Wheel Config
    const internalSize = 340; // Keep SVG coordinates for paths
    const displaySize = 300;  // Increased to ~3 inches

    const center = internalSize / 2;
    const radius = 150; // Relative to internalSize

    // Data with SVG Paths for Icons (Gold/Carved look) and explicit Angles
    const segments = [
        {
            label: 'Breakfast',
            id: 'Breakfast',
            angle: 270,
            img: imgSnack
        },
        {
            label: 'Lunch',
            id: 'Lunch',
            angle: 0,
            img: imgLunch
        },
        {
            label: 'Dinner',
            id: 'Dinner',
            angle: 180,
            img: imgDinner
        },
        {
            label: 'Snack',
            id: 'Snack',
            angle: 90,
            img: imgBreakfast
        }
    ];

    return (
        <div style={{
            width: `${displaySize}px`,
            height: `${displaySize}px`,
            position: 'relative',
            filter: 'drop-shadow(0px 5px 10px rgba(0,0,0,0.5))',
            marginTop: '-10px'
        }}>
            <svg width={displaySize} height={displaySize} viewBox={`0 0 ${internalSize} ${internalSize}`}>
                <defs>
                    {/* Pattern Definition - Scaled */}
                    <pattern id="woodPattern" patternUnits="userSpaceOnUse" width={internalSize} height={internalSize}>
                        <image href={woodTexture} x="0" y="0" width={internalSize} height={internalSize} preserveAspectRatio="xMidYMid slice" />
                    </pattern>

                    {/* Gold Gradient for Icons/Center */}
                    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#fff59d" />
                        <stop offset="50%" stopColor="#fbc02d" />
                        <stop offset="100%" stopColor="#eda000" />
                    </linearGradient>

                    <linearGradient id="goldPressed" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f57f17" />
                        <stop offset="100%" stopColor="#fbc02d" />
                    </linearGradient>

                    {/* Inner Glow for Center/Ring */}
                    <filter id="centerGlow">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    {/* Vignette */}
                    <radialGradient id="vignette" cx="50%" cy="50%" r="50%">
                        <stop offset="60%" stopColor="#000" stopOpacity="0" />
                        <stop offset="100%" stopColor="#000" stopOpacity="0.8" />
                    </radialGradient>
                </defs>

                {/* 1. Base Plate (Texture) - Lightened via filter */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="url(#woodPattern)"
                    stroke="none"
                    style={{ filter: 'brightness(1.6) contrast(1.1) sepia(0.2)' }}
                />

                {/* 1.b Outer Bark Rim (Textured Stroke) */}
                <circle cx={center} cy={center} r={radius + 4} fill="none" stroke="#2d1e18" strokeWidth="12" />
                <circle cx={center} cy={center} r={radius + 4} fill="none" stroke="#1a110d" strokeWidth="12" strokeDasharray="15,5" opacity="0.6" />

                {/* Vignette Overlay */}
                <circle cx={center} cy={center} r={radius} fill="url(#vignette)" />

                {/* 2. Divider Lines (Cross) - Darker/Carved */}
                <g stroke="#1a110d" strokeWidth="3" filter="drop-shadow(0 1px 1px rgba(255,255,255,0.1))">
                    <line x1={center} y1={center - radius} x2={center} y2={center + radius} />
                    <line x1={center - radius} y1={center} x2={center + radius} y2={center} />
                </g>

                {/* 3. Inner Gold Ring (The visual center border) */}
                <circle cx={center} cy={center} r={52} fill="none" stroke="url(#goldGradient)" strokeWidth="3" filter="drop-shadow(0 0 3px gold)" style={{ mixBlendMode: 'screen' }} />
                <circle cx={center} cy={center} r={52} fill="none" stroke="#b8860b" strokeWidth="1" />


                {/* 4. Segments (Clickable Areas) */}
                {segments.map((seg) => {
                    const angle = seg.angle;
                    const isSelected = selected === seg.id;

                    return (
                        <g
                            key={seg.id}
                            transform={`rotate(${angle} ${center} ${center})`}
                            onClick={() => onSelect(seg.id)}
                            style={{ cursor: 'pointer' }}
                        >
                            {/* Invisible wedge for hit area */}
                            <path
                                d={`M${center},${center} L${center},${center - radius} A${radius},${radius} 0 0, 1 ${center + radius},${center} Z`}
                                fill="transparent"
                            />

                            {/* Highlight Overlay */}
                            {isSelected && (
                                <path
                                    d={`M${center},${center} L${center},${center - radius + 4} A${radius - 4},${radius - 4} 0 0, 1 ${center + radius - 4},${center} Z`}
                                    fill="#fff"
                                    opacity="0.15"
                                />
                            )}
                        </g>
                    );
                })}

                {/* 5. Icons & Labels */}
                {segments.map((seg, index) => {
                    // Polar to Cartesian placement (Angle offset by -45 degrees to center in slice, but rotated by 90 increments)
                    // Wait, slice 0 starts at 12 o'clock? SVG paths usually start 3 o'clock.
                    // Let's assume:
                    // Index 0 (Breakfast): Top Right? Or Top Left?
                    // The standard wheel usually: Top-Left=Breakfast?
                    // User image: Top-Left=Breakfast, Top-Right=Lunch, Bottom-Left=Dinner, Bottom-Right=Snack.
                    // My previous logic was 90 deg steps.
                    // Let's explicitly place them based on visual quadrant.

                    // Angles: 225 (TopLeft), 315 (TopRight), 135 (BotRight), 45 (BotLeft) -- Wait, SVG coords y increases down.
                    // Center is (170, 170).
                    // Top-Left:  x < 170, y < 170. Angle ~ 225 deg.
                    // Top-Right: x > 170, y < 170. Angle ~ 315 deg.
                    // Image shows:
                    // Breakfast: Top Left
                    // Lunch: Top Right
                    // Dinner: Bottom Left
                    // Snack: Bottom Right

                    let posAngle;
                    if (index === 0) posAngle = 225; // Breakfast
                    if (index === 1) posAngle = 315; // Lunch
                    if (index === 2) posAngle = 135; // Dinner
                    if (index === 3) posAngle = 45;  // Snack

                    // Swap logic: Text/Icon rotation is 0. Position is distinct.
                    // Actually, let's just map manually
                    let label = seg.label;
                    let imgSource = seg.img;
                    let qX, qY;
                    const offset = 75; // Distance from center

                    if (seg.id === 'Breakfast') { qX = center - offset; qY = center - offset; }
                    if (seg.id === 'Lunch') { qX = center + offset; qY = center - offset; }
                    if (seg.id === 'Dinner') { qX = center - offset; qY = center + offset; }
                    if (seg.id === 'Snack') { qX = center + offset; qY = center + offset; }

                    const isSelected = selected === seg.id;

                    return (
                        <g key={`content-${seg.id}`} transform={`translate(${qX}, ${qY})`} style={{ pointerEvents: 'none' }}>
                            {/* Icon */}
                            <img
                                href={imgSource} // SVG <image> uses href or xlinkHref, but this is inside an SVG?
                            // Wait, OccasionWheel returns a <div>? No, let's check earlier. 
                            // Line 45 returns a <div>... but then line 102 uses <circle>. 
                            // Ah, the previous code likely had an <svg> wrapper I missed in the view?
                            // Let's check line 51-100.
                            />
                            {/* Wait, if it's an SVG, I must use <image>, not <img>. */}
                            <image
                                href={imgSource}
                                x="-20" y="-30"
                                width="40" height="40"
                                style={{
                                    filter: isSelected ? 'drop-shadow(0 0 5px gold)' : 'grayscale(50%) sepia(30%)',
                                    transition: 'all 0.3s'
                                }}
                            />

                            {/* Text */}
                            <text
                                x="0"
                                y="15"
                                textAnchor="middle"
                                fill={isSelected ? "#ffd54f" : "#d7ccc8"}
                                style={{
                                    fontFamily: "'Nunito', sans-serif",
                                    fontWeight: 'bold',
                                    fontSize: '16px',
                                    textShadow: '0 2px 3px rgba(0,0,0,0.8)'
                                }}
                            >
                                {label}
                            </text>
                        </g>
                    );
                })}

                {/* 6. Center Hub (Select Button) */}
                <circle cx={center} cy={center} r="48" fill="url(#woodDark)" stroke="#ffd700" strokeWidth="2" />
                <circle cx={center} cy={center} r="42" fill="url(#goldGradient)" filter="url(#centerGlow)" opacity="0.8" />
                <circle cx={center} cy={center} r="42" fill="url(#woodDark)" opacity="0.6" /> {/* Dim content behind */}

                {/* Center Text */}
                <text x={center} y={center - 5} textAnchor="middle" fill="#fff" style={{ fontFamily: "'Nunito', sans-serif", fontSize: '14px', fontWeight: 'bold', textShadow: '0 2px 2px black' }}>Select</text>
                <text x={center} y={center + 12} textAnchor="middle" fill="#fff" style={{ fontFamily: "'Nunito', sans-serif", fontSize: '14px', fontWeight: 'bold', textShadow: '0 2px 2px black' }}>Occasion</text>

            </svg>
        </div>
    );
};

export default OccasionWheel;
