import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi as axios } from '../utils/api';

const ShadowLogin = () => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Manager requests share API configuration without user-session interceptors.
            const res = await axios.post('/admin/login', { password });

            if (res.data.token) {
                // Store in SESSION storage (clears when tab closes)
                sessionStorage.setItem('adminToken', res.data.token);
                navigate('/rustic-manager-dashboard');
            }
        } catch (err) {
            setError('⛔ Access Denied');
            setPassword('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>🔐 Manager's Vault</h2>
                <div style={styles.line}></div>

                {error && <div style={styles.error}>{error}</div>}

                <form onSubmit={handleLogin} style={styles.form}>
                    <input
                        type="password"
                        placeholder="Enter Master Key..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={styles.input}
                        autoFocus
                    />
                    <button type="submit" style={styles.button} disabled={loading}>
                        {loading ? 'Verifying...' : 'Unlock'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const styles = {
    container: {
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1a1a',
        backgroundImage: 'radial-gradient(circle, #2c2c2c 10%, #1a1a1a 90%)',
        color: '#e0c097'
    },
    card: {
        background: '#2d1b12', // Dark wood
        border: '2px solid #5c3a21',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        textAlign: 'center',
        width: '350px'
    },
    title: {
        fontFamily: 'serif',
        margin: '0 0 10px 0',
        color: '#d4a373'
    },
    line: {
        height: '2px',
        background: '#5c3a21',
        margin: '0 auto 20px auto',
        width: '50%'
    },
    input: {
        width: '100%',
        padding: '12px',
        marginBottom: '20px',
        background: '#1a1a1a',
        border: '1px solid #5c3a21',
        color: '#fff',
        borderRadius: '4px',
        fontSize: '16px',
        textAlign: 'center'
    },
    button: {
        width: '100%',
        padding: '12px',
        background: '#5c3a21',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '16px',
        transition: 'background 0.3s'
    },
    error: {
        color: '#ff6b6b',
        marginBottom: '15px'
    }
};

export default ShadowLogin;
