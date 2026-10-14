import React from 'react';
import scrollBg from '../../assets/rustic-final-scroll.png';

const ParchmentContainer = ({ children, title, sidePanel }) => {
    return (
        <div style={{
            position: 'relative',
            left: '-100px',
            top: '0px',
            width: '860px',
            maxWidth: '100%',
            margin: '0 auto',
            // Adjusted padding to fit content within the paper area (clearing ribbon and frame)
            paddingTop: '130px',
            paddingBottom: '80px',
            paddingLeft: '90px', // Shifted right by 0.2 inches
            paddingRight: '70px',

            backgroundImage: `url(${scrollBg})`,
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            backgroundColor: 'transparent',

            boxShadow: 'none',
            border: 'none',
            borderRadius: '0',

            display: 'flex', // Flex container
            flexDirection: 'column',
            alignItems: 'flex-start', // Align to left side
            gap: '12px',
            minHeight: '650px',
            zIndex: 10
        }}>

            {/* Title integrated into ribbon position */}
            <div style={{
                position: 'absolute',
                top: '35px',
                left: '240px',
                width: '410px',
                textAlign: 'center',
                fontFamily: 'Mynerve, cursive',
                fontSize: '2.5rem',
                fontWeight: 'bold',
                color: '#4e342e',
                textShadow: '0 1px 1px rgba(255,255,255,0.5)',
                transform: 'rotate(-2deg)',
                zIndex: 2
            }}>
                {title}
            </div>

            {/* Content Container - Constrained Width to keep form on the left */}
            <div style={{ width: '410px', marginTop: '20px' }}>
                {children}
            </div>

            {/* Side Panel (Right) - For the Wheel */}
            {sidePanel && (
                <div style={{
                    position: 'absolute',
                    top: '150px',
                    right: '35px',
                    width: '350px',
                    display: 'flex',
                    justifyContent: 'center',
                    zIndex: 5
                }}>
                    {sidePanel}
                </div>
            )}
        </div>
    );
};

export default ParchmentContainer;
