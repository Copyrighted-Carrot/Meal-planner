import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Verify Token on Mount
    useEffect(() => {
        const token = sessionStorage.getItem('adminToken');
        if (!token) {
            navigate('/manager-access');
            return;
        }
        fetchStats(token);
    }, [navigate]);

    const fetchStats = async (token) => {
        try {
            const res = await axios.get('http://localhost:5000/api/admin/stats', {
                headers: { 'x-admin-token': token }
            });
            setStats(res.data);
            setLoading(false);
        } catch (err) {
            alert("Session expired.");
            sessionStorage.removeItem('adminToken');
            navigate('/manager-access');
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('adminToken');
        navigate('/manager-access');
    };

    if (loading) return <div style={styles.container}>Processing Data...</div>;

    const { users, meals, services, systemHealth, cloudinary } = stats;

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>📜 Manager's Logbook</h1>
                    <p style={styles.subtitle}>System Overseer & Statistics</p>
                </div>
                <button onClick={handleLogout} style={styles.logoutBtn}>Lock Up & Leave</button>
            </div>

            {/* --- TOP ROW: HEALTH & USERS --- */}
            <div style={styles.grid}>
                {/* USER STATS */}
                <div style={styles.card}>
                    <h3>👥 Community Ledger</h3>
                    <div style={styles.bigStat}>
                        {users.activeToday} <span style={styles.smallLabel}>Active Today</span>
                    </div>
                    <div style={styles.subStat}>
                        Total Registered: <strong>{users.total}</strong>
                    </div>
                </div>

                {/* DB HEALTH */}
                <div style={styles.card}>
                    <h3>🗄️ Database Vault</h3>
                    <div style={styles.bigStat}>
                        {systemHealth.storage.size}
                    </div>
                    <div style={styles.subStat}>
                        Status: <span style={styles.green}>CONNECTED</span>
                    </div>
                </div>

                {/* CLOUDINARY */}
                <div style={styles.card}>
                    <h3>☁️ Cloud Media</h3>
                    {cloudinary.error ? (
                        <div style={styles.red}>{cloudinary.error}</div>
                    ) : (
                        <>
                            <div style={styles.statRow}>
                                <span>Used:</span>
                                <strong>{cloudinary.usage}</strong>
                            </div>
                            <div style={styles.statRow}>
                                <span>Limit:</span>
                                <span>{cloudinary.limit}</span>
                            </div>
                            <div style={styles.statRow}>
                                <span>Plan:</span>
                                <span>{cloudinary.plan}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <h2 style={{ marginTop: '40px', borderBottom: '1px solid #5c3a21' }}>⚙️ Service Usage (Daily)</h2>

            {/* --- MIDDLE ROW: SERVICES --- */}
            <div style={styles.grid}>
                {/* AI BRAINS */}
                <ServiceCard name="Gemini AI" data={services.Gemini} limit="~20/day" health={systemHealth.gemini} />
                <ServiceCard name="Groq AI" data={services.Groq} limit="~14k/day" health={systemHealth.groq} />

                {/* UTILS */}
                <ServiceCard name="USDA Nutrition" data={services.USDA} limit="Unlim." health="active" />
                <ServiceCard name="Image Uploads" data={services.Cloudinary} limit="N/A" health="active" />
                <ServiceCard name="Google Logins" data={services.GoogleAuth} limit="N/A" health="active" />
            </div>

            {/* --- BOTTOM ROW: CONTENT --- */}
            <h2 style={{ marginTop: '40px', borderBottom: '1px solid #5c3a21' }}>📚 Content Library</h2>
            <div style={styles.grid}>
                <div style={styles.card}>
                    <div style={styles.statRow}>
                        <span>Total Recipes:</span>
                        <strong>{meals.total}</strong>
                    </div>
                    <div style={styles.statRow}>
                        <span>Global (Public):</span>
                        <strong>{meals.global}</strong>
                    </div>
                    <div style={styles.statRow}>
                        <span>Private:</span>
                        <strong>{meals.total - meals.global}</strong>
                    </div>
                </div>
            </div>

        </div>
    );
};

const ServiceCard = ({ name, data, limit, health }) => (
    <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3>{name}</h3>
            {health && (
                <span style={{
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: health === 'active' ? '#14532d' : '#7f1d1d',
                    color: '#fff',
                    height: 'fit-content'
                }}>
                    {health.toUpperCase()}
                </span>
            )}
        </div>

        <div style={styles.statRow}>
            <span>Today's Requests:</span>
            <strong style={{ fontSize: '1.2em' }}>{data.today}</strong>
        </div>
        <div style={styles.statRow}>
            <span>Yesterday:</span>
            <span>{data.yesterday}</span>
        </div>
        <div style={styles.statRow}>
            <span>Failures:</span>
            <span style={data.errors > 0 ? styles.red : styles.green}>{data.errors}</span>
        </div>
        <div style={{ marginTop: '10px', fontSize: '0.8em', color: '#888' }}>
            Limit: {limit}
        </div>
    </div>
);

const styles = {
    container: {
        padding: '40px',
        backgroundColor: '#1a1a1a',
        minHeight: '100vh',
        color: '#e0c097',
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '40px',
        borderBottom: '2px solid #5c3a21',
        paddingBottom: '20px'
    },
    title: { margin: 0, fontSize: '2.5em' },
    subtitle: { margin: 0, color: '#a07e5e' },
    logoutBtn: {
        background: '#8b0000',
        color: '#fff',
        border: 'none',
        padding: '10px 20px',
        cursor: 'pointer',
        borderRadius: '5px',
        fontWeight: 'bold'
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginTop: '20px'
    },
    card: {
        background: '#2d1b12',
        padding: '20px',
        borderRadius: '10px',
        border: '1px solid #5c3a21',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
    },
    statRow: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid #3d2b22'
    },
    bigStat: {
        fontSize: '36px',
        fontWeight: 'bold',
        color: '#d4a373'
    },
    smallLabel: {
        fontSize: '16px',
        fontWeight: 'normal',
        color: '#888'
    },
    subStat: {
        marginTop: '10px',
        color: '#aaa'
    },
    green: { color: '#4ade80' },
    red: { color: '#f87171' }
};

export default AdminDashboard;
