import React, { useState, useRef, useEffect } from 'react';
import api from '../../utils/api';
import { useCarrot } from '../../context/CarrotContext';
import iconBasket from '../../assets/icon-basket.svg';
import { parseIngredient, formatIngredient } from '../../utils/ingredientParser';

const IngredientsIcon = (props) => <img src={iconBasket} alt="Ingredients" style={{ ...props.style, width: '100%', height: '100%', fill: undefined, objectFit: 'contain' }} />;

// --- Constants ---
const UNITS = [
    { val: 'x', label: '-' },
    { val: 'g', label: 'Gram' },
    { val: 'kg', label: 'Kilogram' },
    { val: 'ml', label: 'Millilitre' },
    { val: 'l', label: 'Litre' },
    { val: 'cup', label: 'Cup' },
    { val: 'tbsp', label: 'Table Spoon' },
    { val: 'tsp', label: 'Tea Spoon' },
    { val: 'bunch', label: 'Bunch' },
    { val: 'pinch', label: 'Pinch' },
    { val: 'packet', label: 'Packet' },
    { val: 'handful', label: 'Handful' },
    { val: 'piece', label: 'Piece' },
    { val: 'slice', label: 'Slice' },
    { val: 'spoon', label: 'Spoon' },
    { val: 'glass', label: 'Glass' },
    { val: 'bowl', label: 'Bowl' },
    { val: 'count', label: 'Count' },
    { val: 'can', label: 'Can' },
];

// --- Custom Rustic Dropdown ---
const CustomSelect = ({ value, onChange, options }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.val === value)?.label || value;

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '90px' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    background: '#fff',
                    border: '1px solid #a1887f',
                    borderRadius: '4px',
                    padding: '5px',
                    fontFamily: 'Nunito',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
                <span style={{ fontSize: '0.7rem', color: '#5d4037' }}>▼</span>
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%', // FORCE DOWN
                    left: 0,
                    width: '100%',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    background: '#fff',
                    border: '1px solid #a1887f',
                    borderRadius: '4px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                    zIndex: 9999, // Ensure it is on top of everything
                }}>
                    {options.map(opt => (
                        <div
                            key={opt.val}
                            onClick={() => { onChange(opt.val); setIsOpen(false); }}
                            style={{
                                padding: '5px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                color: '#3e2723',
                                fontFamily: 'Nunito',
                                backgroundColor: value === opt.val ? '#efebe9' : '#fff',
                                borderBottom: '1px solid #f5f5f5'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#d7ccc8'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = value === opt.val ? '#efebe9' : '#fff'}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

function IngredientManager({ ingredients, onChange }) {
    const { say } = useCarrot();
    // Mode State
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [isParsing, setIsParsing] = useState(false);

    // Temp State for Structured Input
    const [tempQty, setTempQty] = useState("");
    const [tempUnit, setTempUnit] = useState("x");
    const [tempName, setTempName] = useState("");

    // Bulk Text State
    const [bulkText, setBulkText] = useState("");

    const [editingIndex, setEditingIndex] = useState(null);
    const [chips, setChips] = useState([]);

    useEffect(() => {
        if (!ingredients) {
            setChips([]);
            return;
        }
        const list = typeof ingredients === 'string' ? ingredients.split(',') : ingredients;
        const parsed = list.map(item => parseIngredient(item)).filter(i => i !== null);
        setChips(parsed);
    }, [ingredients]);

    // Helper to update parent with new stringified list
    const updateParent = (newChips) => {
        setChips(newChips);
        const stringified = newChips.map(c => formatIngredient(c)).join(', ');
        onChange(stringified);
    };

    const handleAdd = () => {
        if (!tempName.trim()) return;

        const newIng = {
            qty: tempQty, // Allow empty
            unit: tempUnit,
            name: tempName.trim()
        };

        const newChips = [...chips, newIng];
        updateParent(newChips);

        // Reset
        setTempQty("");
        setTempUnit("x");
        setTempName("");
    };

    const handleProcessBulk = async () => {
        if (!bulkText.trim()) return;

        setIsParsing(true);
        try {
            // Call AI Endpoint
            const res = await api.post('/ai/parse',
                { text: bulkText }
            );

            if (res.data && Array.isArray(res.data)) {
                const newChips = [...chips, ...res.data];
                updateParent(newChips);
                setBulkText("");
                setIsBulkMode(false);
            }
        } catch (err) {
            console.error("AI Parse Failed, falling back to regex", err);
            // Smoother message for Quota/Rate Limits
            const errMsg = err.response?.data?.msg || err.message;
            const isQuota = errMsg && (errMsg.includes("429") || errMsg.includes("quota"));
            const sayMsg = isQuota
                ? "🥕 The AI is taking a nap (Rate Limit). Using my Basic Brain!"
                : `🥕 AI Hiccup! (${errMsg}). Using Basic Brain.`;

            say(sayMsg);

            // Fallback to local regex if AI fails
            const lines = bulkText.split(/\n|,/).map(l => l.trim()).filter(l => l);
            const parsedItems = lines.map(line => parseIngredient(line)).filter(i => i !== null);
            const newChips = [...chips, ...parsedItems];
            updateParent(newChips);
            setBulkText("");
            setIsBulkMode(false);
        } finally {
            setIsParsing(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    const handleDelete = (index) => {
        const newChips = [...chips];
        newChips.splice(index, 1);
        updateParent(newChips);
    };

    const handleEditChange = (index, field, value) => {
        const newChips = [...chips];
        newChips[index][field] = value;
        updateParent(newChips);
    };

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Mode Toggle */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    type="button"
                    onClick={() => setIsBulkMode(!isBulkMode)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#5d4037',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                    }}
                >
                    {isBulkMode ? "Switch to Single Entry" : "📝 Paste Recipe List"}
                </button>
            </div>

            {/* INPUT PLANK */}
            <div style={{ position: 'relative', width: '100%', zIndex: 10 }}> {/* High Z-Index for dropdowns */}
                {/* Plank Background */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    borderRadius: '8px',
                    border: '2px solid #8d6e63',
                    zIndex: 0
                }}></div>

                {isBulkMode ? (
                    /* BULK MODE */
                    <div style={{ position: 'relative', zIndex: 1, padding: '10px' }}>
                        <textarea
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                            placeholder={"Paste list here...\n1 Cup Rice\n500g Chicken\n..."}
                            style={{
                                width: '100%',
                                height: '80px',
                                background: 'transparent',
                                border: 'none',
                                fontFamily: 'Nunito',
                                fontSize: '0.9rem',
                                color: '#3e2723',
                                outline: 'none',
                                resize: 'vertical'
                            }}
                        />
                        <button
                            type="button"
                            onClick={handleProcessBulk}
                            disabled={isParsing}
                            style={{
                                marginTop: '5px',
                                width: '100%',
                                background: isParsing ? '#a1887f' : '#5d4037',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '5px',
                                fontWeight: 'bold',
                                cursor: isParsing ? 'wait' : 'pointer'
                            }}
                        >
                            {isParsing ? "✨ Parsing with AI..." : "Process List 🥕"}
                        </button>
                    </div>
                ) : (
                    /* SINGLE ENTRY MODE */
                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', padding: '10px', gap: '8px' }}>

                        <div style={{ width: '30px', height: '30px', flexShrink: 0 }}>
                            <IngredientsIcon />
                        </div>

                        {/* Qty */}
                        <input
                            type="number"
                            value={tempQty}
                            onChange={(e) => setTempQty(e.target.value)}
                            placeholder="1"
                            style={{
                                width: '50px',
                                background: '#fff',
                                border: '1px solid #a1887f',
                                borderRadius: '4px',
                                padding: '5px',
                                fontFamily: 'Nunito',
                                fontWeight: 'bold',
                                textAlign: 'center'
                            }}
                        />

                        {/* Dropdown (Standard Select for now, but ensured Z-Index above) */}
                        <CustomSelect
                            value={tempUnit}
                            onChange={(val) => setTempUnit(val)}
                            options={UNITS}
                        />

                        {/* Name */}
                        <input
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ingredient..."
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                borderBottom: '1px dashed #5d4037',
                                fontFamily: 'Nunito',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                color: '#3e2723',
                                outline: 'none',
                                padding: '5px'
                            }}
                        />

                        <button
                            type="button"
                            onClick={handleAdd}
                            style={{
                                background: '#5d4037',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                width: '30px',
                                height: '30px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold'
                            }}
                        >
                            +
                        </button>
                    </div>
                )}
            </div>
            {/* CHIPS CONTAINER */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 5px' }}>
                {chips.map((chip, index) => {
                    const isInvalid = !chip.qty || chip.qty.trim() === '' || chip.qty === '0' || !chip.name || chip.name.trim() === '' || chip.unit === 'x';

                    return (
                        <div key={index} style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: isInvalid ? '#ffebee' : '#fff8e1', // Light red bg if invalid
                            border: isInvalid ? '1px solid #ef5350' : '1px solid #d7ccc8', // Red border
                            borderRadius: '20px',
                            padding: '4px 10px',
                            boxShadow: '1px 1px 3px rgba(0,0,0,0.1)',
                            fontFamily: 'Nunito',
                            fontSize: '0.9rem',
                            fontWeight: '700',
                            color: isInvalid ? '#c62828' : '#5d4037', // Red text
                            cursor: 'pointer'
                        }}>
                            {editingIndex === index ? (
                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                    <input
                                        type="text"
                                        value={chip.qty}
                                        onChange={(e) => handleEditChange(index, 'qty', e.target.value)}
                                        placeholder="?"
                                        style={{ width: '40px', border: '1px solid #ccc', borderRadius: '3px', padding: '2px', fontSize: '0.8rem' }}
                                    />
                                    {/* ... existing edit mode ... */}
                                    <select
                                        value={chip.unit}
                                        onChange={(e) => handleEditChange(index, 'unit', e.target.value)}
                                        style={{ border: '1px solid #ccc', borderRadius: '3px', padding: '2px', fontSize: '0.8rem' }}
                                    >
                                        {[...UNITS, { val: 'pc', label: 'pc' }].map(u => <option key={u.val} value={u.val}>{u.label}</option>)}
                                    </select>
                                    <input
                                        type="text"
                                        value={chip.name}
                                        onChange={(e) => handleEditChange(index, 'name', e.target.value)}
                                        style={{ width: '80px', border: '1px solid #ccc', borderRadius: '3px', padding: '2px', fontSize: '0.8rem' }}
                                    />
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditingIndex(null); }} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>✅</button>
                                </div>
                            ) : (
                                <div onClick={() => setEditingIndex(index)} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span>{formatIngredient(chip)}</span>
                                    {isInvalid && <span style={{ fontSize: '0.8rem', color: '#d32f2f', marginLeft: '4px' }}>⚠️</span>}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDelete(index); }}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    marginLeft: '8px',
                                    color: '#e57373',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                ×
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    );
}

export default IngredientManager;
