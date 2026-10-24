import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../utils/cropUtils';
import rusticCarrotBtn from '../../assets/rustic-carrot-btn.png';
import useDialogFocus from '../../hooks/useDialogFocus';
import '../UserDialogs.css';

const ImageCropper = ({ imageSrc, onCropComplete, onCancel }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const dialogRef = useDialogFocus(true, onCancel);

    const onCropChange = (crop) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom) => {
        setZoom(zoom);
    };

    const onCropCompleteCallback = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        try {
            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
            onCropComplete(croppedImage, croppedAreaPixels);
        } catch (e) {
            console.error(e);
            alert("Failed to crop image.");
        }
    };

    return (
        <div ref={dialogRef} className="recipe-crop-overlay" role="dialog" aria-modal="true" aria-label="Crop recipe image" tabIndex={-1} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
        }}>
            <div className="recipe-crop-stage" style={{
                position: 'relative',
                backgroundColor: '#333',
                overflow: 'hidden',
            }}>
                <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={3 / 2} // Matching the card image aspect roughly
                    onCropChange={onCropChange}
                    onCropComplete={onCropCompleteCallback}
                    onZoomChange={onZoomChange}
                />
            </div>

            <div className="recipe-crop-controls" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '15px',
            }}>
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--rustic-ink)' }}>
                    <label htmlFor="recipe-image-zoom" style={{ fontWeight: 'bold' }}>Image zoom</label>
                    <input
                        id="recipe-image-zoom"
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer' }}
                    />
                </div>

                <div className="recipe-crop-actions">
                    <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        style={{
                            padding: '10px 30px',
                            background: `url(${rusticCarrotBtn}) no-repeat center`,
                            backgroundSize: '100% 100%',
                            border: 'none',
                            color: '#3e2723',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '120px'
                        }}
                    >
                        ✂️ Use cropped image
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageCropper;
