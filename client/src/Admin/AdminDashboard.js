import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi as axios } from '../utils/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import UserManagement from './UserManagement'; // USER COCKPIT

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [history, setHistory] = useState([]);
    const [errors, setErrors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('api');
    const [expandedApi, setExpandedApi] = useState(null);
    const [timeRange, setTimeRange] = useState('week');
    const navigate = useNavigate();

    const token = sessionStorage.getItem('adminToken');

    useEffect(() => {
        if (!token) {
            navigate('/manager-access');
            return;
        }

        // IDLE TIMER LOGIC
        let timeoutId;
        const TIMEOUT_DURATION = 60 * 60 * 1000; // 1 Hour

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                alert("Manager Session Expired. Please Re-authenticate.");
                sessionStorage.removeItem('adminToken');
                window.location.href = '/manager-access';
            }, TIMEOUT_DURATION);
        };

        // Listeners
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
        const handleActivity = () => resetTimer();
        resetTimer();
        events.forEach(e => document.addEventListener(e, handleActivity));

        // INITIAL FETCH
        fetchStats();

        // AUTO-REFRESH (Real-Time Mode)
        const intervalId = setInterval(() => {
            fetchStats();
        }, 8000); // 8 Seconds (Matches Server Smart Throttle)

        return () => {
            clearInterval(intervalId);
            if (timeoutId) clearTimeout(timeoutId);
            events.forEach(e => document.removeEventListener(e, handleActivity));
        };
    }, [navigate, token]);

    const fetchStats = async () => {
        try {
            const res = await axios.get('/admin/stats', { headers: { 'x-admin-token': token } });
            setStats(res.data);
            setLoading(false);
        } catch (err) {
            handleError(err);
        }
    };

    const fetchHistory = async (service) => {
        try {
            const res = await axios.get(`/admin/history?service=${service}`, { headers: { 'x-admin-token': token } });
            setHistory(res.data);
            const errRes = await axios.get(`/admin/errors?service=${service}`, { headers: { 'x-admin-token': token } });
            setErrors(errRes.data);
        } catch (err) {
            console.error("Failed to fetch history");
        }
    };

    const handleError = (err) => { };

    const handleLogout = () => {
        sessionStorage.removeItem('adminToken');
        navigate('/manager-access');
    };

    const toggleApi = (apiName) => {
        if (expandedApi === apiName) {
            setExpandedApi(null);
        } else {
            setExpandedApi(apiName);
            fetchHistory(apiName);
        }
    };

    if (loading) return <div style={styles.container}>Initializing Mission Control...</div>;

    const { users, systemHealth, cloudinary, usage } = stats;

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}><span style={{ fontSize: '1.2em' }}>🛡️</span> Admin Console</h1>
                    <p style={styles.subtitle}>System Status: <span style={{ color: '#4ade80' }}>ONLINE</span></p>
                </div>
                <div style={styles.headerActions}>
                    <button onClick={fetchStats} style={styles.refreshBtn} title="Force Refresh Data">
                        🔄
                    </button>
                    <div style={{ display: 'flex', gap: '5px', background: '#222', padding: '4px', borderRadius: '8px' }}>
                        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</TabButton>
                        <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')}>👥 Users</TabButton>
                        <TabButton active={activeTab === 'api'} onClick={() => setActiveTab('api')}>🔌 API</TabButton>
                    </div>
                </div>
            </div>

            <div style={styles.content}>
                {/* --- USER MANAGEMENT TAB --- */}
                {activeTab === 'users' ? (
                    <UserManagement styles={styles} />
                ) : (
                    /* RENDER OTHER TABS AS NORMAL */
                    <>
                        {/* --- OVERVIEW --- */}
                        {activeTab === 'overview' && (
                            <div style={styles.grid}>
                                <StatCard icon="👥" title="Active Users" value={users?.activeToday || 0} sub={`Total: ${users?.total}`} />
                                <StatCard icon="🗄️" title="DB Storage" value={systemHealth?.storage?.size || 'N/A'} sub="Mongo Atlas" />
                                <StatCard icon="☁️" title="Cloud Storage" value={cloudinary?.usage || 'N/A'} sub={`${cloudinary?.credits || 0} credits`} />
                            </div>
                        )}

                        {/* --- API MANAGER --- */}
                        {activeTab === 'api' && (
                            <div style={styles.apiList}>
                                <h2 style={{ borderBottom: '1px solid #444', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>🔌 API Integrations</span>
                                    <div style={styles.rangeSelector}>
                                        {['today', 'yesterday', 'week', 'month', '6m', 'year'].map(r => (
                                            <button
                                                key={r}
                                                style={timeRange === r ? styles.rangeBtnActive : styles.rangeBtn}
                                                onClick={() => setTimeRange(r)}
                                            >
                                                {r.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </h2>

                                {/* GEMINI */}
                                <ApiAccordion
                                    name="Gemini AI"
                                    isOpen={expandedApi === 'Gemini'}
                                    onClick={() => toggleApi('Gemini')}
                                    status={systemHealth?.gemini}
                                    link="https://aistudio.google.com/"
                                >
                                    <SingleModelView
                                        modelName="Gemini Flash"
                                        filterKey="Gemini"
                                        history={history}
                                        errors={errors}
                                        range={timeRange}
                                    />
                                </ApiAccordion>

                                {/* GROQ */}
                                <ApiAccordion
                                    name="Groq AI"
                                    isOpen={expandedApi === 'Groq'}
                                    onClick={() => toggleApi('Groq')}
                                    status={systemHealth?.groq}
                                    link="https://console.groq.com/"
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                                        <SingleModelView
                                            modelName="Llama 3.3 70b (Versatile)"
                                            filterKey="Groq:70b-Versatile"
                                            history={history}
                                            errors={errors}
                                            range={timeRange}
                                        />
                                        <div style={{ borderBottom: '1px dashed #444' }}></div>
                                        <SingleModelView
                                            modelName="Llama 3.1 8b (Instant)"
                                            filterKey="Groq:8b-Instant"
                                            history={history}
                                            errors={errors}
                                            range={timeRange}
                                        />
                                    </div>
                                </ApiAccordion>

                                <ApiAccordion
                                    name="Cloudinary"
                                    isOpen={expandedApi === 'Cloudinary'}
                                    onClick={() => toggleApi('Cloudinary')}
                                    status={cloudinary?.error ? 'error' : 'active'}
                                    link="https://cloudinary.com/console"
                                >
                                    <CloudinaryDetailView
                                        stats={cloudinary}
                                        history={history}
                                        range={timeRange}
                                    />
                                </ApiAccordion>

                                {/* MONGODB (New Section) */}
                                <ApiAccordion
                                    name="MongoDB Atlas"
                                    isOpen={expandedApi === 'Mongo'}
                                    onClick={() => toggleApi('Mongo')}
                                    status={systemHealth?.mongo === 'connected' ? 'active' : 'error'}
                                    link="https://cloud.mongodb.com/"
                                >
                                    <MongoDetailView stats={stats?.mongo} />
                                </ApiAccordion>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* GLOBAL ERROR LOG - Shown always if errors exist, or only on overview? Layout choice: Always show at bottom */}
            {errors.length > 0 && activeTab !== 'users' && (
                <div style={styles.errorSection}>
                    <h4>🛑 Last Failures</h4>
                    {errors.slice(0, 5).map((e, i) => (
                        <div key={i} style={styles.errorItem}>
                            [{new Date(e.timestamp).toLocaleTimeString()}] {e.errorMessage}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- SUB COMPONENTS ---

const CloudinaryDetailView = ({ stats, history, range }) => {
    const [showGallery, setShowGallery] = useState(false);
    const [images, setImages] = useState([]);
    const [loadingImages, setLoadingImages] = useState(false);
    const token = sessionStorage.getItem('adminToken');

    const toggleGallery = async () => {
        if (!showGallery && images.length === 0) {
            setLoadingImages(true);
            try {
                const res = await axios.get('/admin/images', { headers: { 'x-admin-token': token } });
                setImages(res.data);
            } catch (err) {
                console.error("Gallery Error", err);
            }
            setLoadingImages(false);
        }
        setShowGallery(!showGallery);
    };

    // 1. FILTER DATA
    const now = new Date();
    const rangeStart = new Date();

    if (range === 'yesterday') rangeStart.setDate(now.getDate() - 1);
    if (range === 'week') rangeStart.setDate(now.getDate() - 7);
    if (range === 'month') rangeStart.setMonth(now.getMonth() - 1);
    if (range === '6m') rangeStart.setMonth(now.getMonth() - 6);
    if (range === 'year') rangeStart.setFullYear(now.getFullYear() - 1);
    if (range === 'today') rangeStart.setHours(0, 0, 0, 0);

    // "dataUsed" from backend is in BYTES.
    const filteredLogs = history.filter(h => {
        const d = new Date(h.date);
        // Date Check
        const inRange = range === 'yesterday'
            ? d.toDateString() === rangeStart.toDateString()
            : d >= rangeStart;
        return inRange;
    });

    const totalUploads = filteredLogs.reduce((acc, l) => acc + (l.requests || 0), 0);
    const totalBytes = filteredLogs.reduce((acc, l) => acc + (l.dataUsed || 0), 0);
    const totalDeletes = filteredLogs.reduce((acc, l) => acc + (l.deletedCount || 0), 0);

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 MB';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div style={{ padding: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ ...styles.h3, marginBottom: 0 }}>Storage & Bandwidth</h3>
                <button onClick={toggleGallery} style={{
                    background: showGallery ? '#4ade80' : '#333',
                    color: showGallery ? '#000' : '#fff',
                    border: 'none', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'
                }}>
                    {showGallery ? 'Hide Gallery' : '📸 View Gallery'}
                </button>
            </div>

            {showGallery ? (
                <div style={{ background: '#000', padding: '20px', borderRadius: '10px', maxHeight: '500px', overflowY: 'auto' }}>
                    {loadingImages ? <div style={{ color: '#888' }}>Loading Cloudinary Assets...</div> : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px' }}>
                            {images.map(img => (
                                <a key={img.public_id} href={img.secure_url} target="_blank" rel="noreferrer" style={{ position: 'relative', display: 'block', aspectRatio: '1/1' }}>
                                    <img src={img.secure_url} alt="cloud-asset" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '5px', border: '1px solid #333' }} />
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.7em', padding: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {(img.bytes / 1024).toFixed(0)} KB
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* STORAGE CAPACITY */}
                    <div style={{ marginBottom: '20px', background: '#222', padding: '20px', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#ccc' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                🗄️ Storage
                                <span style={{ fontSize: '0.8em', color: '#888' }}>({stats?.usage_percent}% Used)</span>
                            </span>
                            <span style={{ fontWeight: 'bold', color: '#fff' }}>{stats?.usage} / {stats?.limit}</span>
                        </div>
                        <div style={{ width: '100%', height: '12px', background: '#333', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${Math.min(parseFloat(stats?.usage_percent || 0), 100)}%`,
                                height: '100%',
                                background: parseFloat(stats?.usage_percent) > 80
                                    ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                                    : 'linear-gradient(90deg, #4ade80, #3b82f6)'
                            }}></div>
                        </div>
                        <div style={{ marginTop: '5px', fontSize: '0.8em', color: '#666', textAlign: 'right' }}>
                            {stats?.credits} of Total Plan Credits
                        </div>
                    </div>

                    {/* COUNTERS GRID */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '30px' }}>
                        <div style={styles.kpi}>
                            <div style={styles.kpiLabel}>Total Images (Active)</div>
                            <div style={styles.kpiValue}>{stats?.total_images}</div>
                            <div style={{ fontSize: '0.8em', color: '#888' }}>On Cloudinary</div>
                        </div>
                        <div style={styles.kpi}>
                            <div style={styles.kpiLabel}>All-Time Uploads</div>
                            <div style={styles.kpiValue}>{stats?.lifetime_uploads}</div>
                            <div style={{ fontSize: '0.8em', color: '#4ade80' }}>Since Inception</div>
                        </div>
                        <div style={styles.kpi}>
                            <div style={styles.kpiLabel}>All-Time Deletes</div>
                            <div style={styles.kpiValue}>{stats?.lifetime_deletes}</div>
                            <div style={{ fontSize: '0.8em', color: '#f87171' }}>Since Inception</div>
                        </div>
                    </div>

                    {/* PLAN CURRENT USAGE (New Section) */}
                    <div style={{ marginBottom: '30px', background: '#222', padding: '20px', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                            <div>
                                <h4 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.1em', border: 'none' }}>Plan Current Usage</h4>
                                <p style={{ margin: 0, color: '#888', fontSize: '0.85em' }}>Credit Usage For Last 30 Days</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.8em', background: '#333', padding: '4px 8px', borderRadius: '4px', color: '#aaa' }}>{stats?.plan} Plan</span>
                            </div>
                        </div>

                        <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ color: '#ccc', fontSize: '1em' }}>Credit Details</span>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#fff', display: 'block' }}>
                                    {stats?.credits_usage} / {stats?.credits_limit}
                                </span>
                                <span style={{ fontSize: '0.8em', color: parseFloat(stats?.credits_percent) > 80 ? '#f87171' : '#4ade80' }}>
                                    ({stats?.credits_percent}% Used)
                                </span>
                            </div>
                        </div>
                        {/* Progress Bar for Credits */}
                        <div style={{ width: '100%', height: '6px', background: '#333', borderRadius: '3px', marginTop: '15px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${Math.min(parseFloat(stats?.credits_percent || 0), 100)}%`,
                                height: '100%',
                                background: parseFloat(stats?.credits_percent) > 90 ? '#ef4444' : '#818cf8'
                            }}></div>
                        </div>
                    </div>

                    {/* BANDWIDTH CAPACITY */}
                    <div style={{ marginBottom: '30px', background: '#222', padding: '20px', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#ccc' }}>
                            <span>🚀 Bandwidth</span>
                            <span>{stats?.bandwidth_usage} / {stats?.bandwidth_limit}</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#333', borderRadius: '5px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${Math.min(parseFloat(stats?.bandwidth_percent || 0), 100)}%`,
                                height: '100%',
                                background: '#8b5cf6'
                            }}></div>
                        </div>
                    </div>

                    {/* RECENT ACTIVITY */}
                    <h4 style={styles.h4}>Activity ({range.toUpperCase()})</h4>
                    <div style={{ display: 'flex', gap: '20px', gridTemplateColumns: '1fr 1fr' }}>
                        {/* UPLOADS */}
                        <div style={{ ...styles.kpi, borderLeft: '4px solid #4ade80' }}>
                            <div style={styles.kpiLabel}>Images Uploaded</div>
                            <div style={styles.kpiValue}>{totalUploads}</div>
                            <div style={{ color: '#4ade80', fontSize: '0.9em' }}>+ {formatBytes(totalBytes)} Added</div>
                        </div>

                        {/* DELETES */}
                        <div style={{ ...styles.kpi, borderLeft: '4px solid #f87171' }}>
                            <div style={styles.kpiLabel}>Images Deleted</div>
                            <div style={styles.kpiValue}>{totalDeletes}</div>
                            <div style={{ color: '#f87171', fontSize: '0.9em' }}>- Freed Space</div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const SingleModelView = ({ modelName, filterKey, history, errors, range }) => {
    // 1. FILTER DATA BY RANGE & MODEL
    const now = new Date();
    const rangeStart = new Date();

    if (range === 'yesterday') rangeStart.setDate(now.getDate() - 1);
    if (range === 'week') rangeStart.setDate(now.getDate() - 7);
    if (range === 'month') rangeStart.setMonth(now.getMonth() - 1);
    if (range === '6m') rangeStart.setMonth(now.getMonth() - 6);
    if (range === 'year') rangeStart.setFullYear(now.getFullYear() - 1);
    if (range === 'today') rangeStart.setHours(0, 0, 0, 0);

    const filteredData = history.filter(h => {
        const d = new Date(h.date);
        const inRange = range === 'yesterday'
            ? d.toDateString() === rangeStart.toDateString()
            : d >= rangeStart;

        const matchesModel = filterKey.includes(':')
            ? h.service === filterKey
            : h.service.startsWith(filterKey);

        return inRange && matchesModel;
    });

    const chartData = filteredData.map(h => ({
        name: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        req: h.requests,
        err: h.errors,
        success: h.requests - h.errors
    }));

    const totalReq = filteredData.reduce((acc, curr) => acc + curr.requests, 0);
    const totalErr = filteredData.reduce((acc, curr) => acc + curr.errors, 0);

    return (
        <div style={styles.modelSection}>
            <h3 style={styles.h3}>{modelName}</h3>

            <div style={styles.kpiRow}>
                <div style={styles.kpi}>
                    <div style={styles.kpiLabel}>Total Requests ({range})</div>
                    <div style={styles.kpiValue}>{totalReq}</div>
                </div>
                <div style={styles.kpi}>
                    <div style={styles.kpiLabel}>Success Rate</div>
                    <div style={{ ...styles.kpiValue, color: (totalReq - totalErr) > 0 ? '#4ade80' : '#888' }}>
                        {totalReq > 0 ? ((1 - totalErr / totalReq) * 100).toFixed(1) : 0}%
                    </div>
                </div>
                <div style={styles.kpi}>
                    <div style={styles.kpiLabel}>Failures</div>
                    <div style={{ ...styles.kpiValue, color: totalErr > 0 ? '#f87171' : '#888' }}>{totalErr}</div>
                </div>
            </div>

            <div style={styles.chartsRow}>
                <div style={styles.chartBox}>
                    <h4 style={styles.chartTitle}>📈 Usage Trend</h4>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="name" stroke="#666" fontSize={12} />
                            <YAxis stroke="#666" fontSize={12} />
                            <Tooltip contentStyle={{ background: '#222', border: '1px solid #444' }} />
                            <Area type="monotone" dataKey="req" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div style={styles.chartBox}>
                    <h4 style={styles.chartTitle}>📊 Success vs Failure</h4>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="name" stroke="#666" fontSize={12} />
                            <YAxis stroke="#666" fontSize={12} />
                            <Tooltip contentStyle={{ background: '#222', border: '1px solid #444' }} />
                            <Legend />
                            <Bar dataKey="success" stackId="a" fill="#4ade80" name="Success" />
                            <Bar dataKey="err" stackId="a" fill="#f87171" name="Error" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

const TabButton = ({ active, children, onClick }) => (
    <button onClick={onClick} style={{
        background: active ? '#444' : 'transparent',
        color: active ? '#fff' : '#aaa',
        border: 'none',
        padding: '12px 24px',
        cursor: 'pointer',
        fontWeight: 'bold',
        borderBottom: active ? '2px solid #4ade80' : '2px solid transparent',
        transition: 'all 0.2s'
    }}>
        {children}
    </button>
);

const StatCard = ({ icon, title, value, sub }) => (
    <div style={styles.card}>
        <div style={{ fontSize: '2em', marginBottom: '10px' }}>{icon}</div>
        <div style={{ fontSize: '0.9em', color: '#aaa' }}>{title}</div>
        <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#fff' }}>{value}</div>
        <div style={{ fontSize: '0.8em', color: '#666' }}>{sub}</div>
    </div>
);

const MongoDetailView = ({ stats }) => {
    if (!stats) return <div style={{ padding: '20px', color: '#888' }}>Loading Database Stats...</div>;

    // Calculate usage relative to 512MB Free Tier (Using CLUSTER size now)
    const FREE_TIER_LIMIT = 512;
    const totalClusterSize = parseFloat(stats.clusterSize || stats.storageSize);
    const usedPercent = (totalClusterSize / FREE_TIER_LIMIT) * 100;

    return (
        <div style={{ padding: '10px' }}>
            <h3 style={styles.h3}>Cluster Storage (Real-Time)</h3>

            {/* MAIN CAPACITY BAR (CLUSTER) */}
            <div style={{ marginBottom: '30px', background: '#222', padding: '20px', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#ccc' }}>
                    <span>☁️ Total Cluster Usage</span>
                    <span style={{ fontWeight: 'bold', color: '#fff' }}>
                        {totalClusterSize} MB / 512 MB <span style={{ fontSize: '0.8em', color: usedPercent > 80 ? '#f87171' : '#4ade80' }}>({usedPercent.toFixed(2)}%)</span>
                    </span>
                </div>
                <div style={{ width: '100%', height: '15px', background: '#333', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{
                        width: `${Math.min(usedPercent, 100)}%`,
                        height: '100%',
                        background: usedPercent > 80 ? '#ef4444' : (usedPercent > 50 ? '#f59e0b' : '#4ade80'),
                        transition: 'width 0.5s ease'
                    }}></div>
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.8em', color: '#888', textAlign: 'right' }}>
                    Includes all databases in your account
                </div>
            </div>

            {/* DATABASE BREAKDOWN */}
            {stats.clusterDetails && (
                <div style={{ marginBottom: '20px', padding: '10px', background: '#151515', borderRadius: '8px' }}>
                    <h4 style={{ ...styles.h4, marginTop: 0 }}>Databases Found:</h4>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {stats.clusterDetails.map(db => (
                            <span key={db.name} style={{
                                background: db.name === 'test' ? '#2563eb' : (db.name.includes('sample') ? '#b91c1c' : '#444'),
                                padding: '4px 8px', borderRadius: '4px', fontSize: '0.8em', color: '#fff', display: 'flex', alignItems: 'center', gap: '5px'
                            }}>
                                {db.name}: {db.size}
                                {db.name === 'test' && <span style={{ fontSize: '0.8em' }}> (This App)</span>}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* APP METRICS GRID */}
            <h4 style={styles.h4}>App Internal Stats (test)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                <div style={styles.kpi}>
                    <div style={styles.kpiLabel}>Data Size</div>
                    <div style={styles.kpiValue}>{stats.dataSize} MB</div>
                    <div style={{ fontSize: '0.8em', color: '#4ade80' }}>Actual Content</div>
                </div>
                <div style={styles.kpi}>
                    <div style={styles.kpiLabel}>Documents</div>
                    <div style={styles.kpiValue}>{stats.objects}</div>
                    <div style={{ fontSize: '0.8em', color: '#ccc' }}>Average: {stats.avgObjSize}</div>
                </div>
            </div>

            {/* COLLECTION BREAKDOWN */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                {stats.collections.map(col => (
                    <div key={col.name} style={{ background: '#1a1a1a', padding: '10px', borderRadius: '8px', border: '1px solid #333' }}>
                        <div style={{ color: '#888', fontSize: '0.75em', marginBottom: '2px', textTransform: 'uppercase' }}>{col.name}</div>
                        <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1em' }}>{col.count}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ApiAccordion = ({ name, isOpen, onClick, status, link, children }) => (
    <div style={styles.accordionItem}>
        <div style={styles.accordionHeader} onClick={onClick}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '15px', color: '#888', fontSize: '0.8em' }}>{isOpen ? '▼' : '▶'}</span>
                <span style={{ fontWeight: 'bold', fontSize: '1.2em', color: '#ccc' }}>{name}</span>
                <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: status === 'active' ? '#14532d' : '#7f1d1d',
                    color: '#fff',
                    marginLeft: '15px'
                }}>
                    {status?.toUpperCase() || 'UNKNOWN'}
                </span>
            </div>
            {isOpen && link && (
                <a href={link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={styles.linkBtn}>
                    Open Console ↗
                </a>
            )}
        </div>
        {isOpen && (
            <div style={styles.accordionContent}>
                {children}
            </div>
        )}
    </div>
);

const styles = {
    container: { padding: '40px', backgroundColor: '#111', minHeight: '100vh', color: '#eee', fontFamily: 'Inter, sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', marginBottom: '30px', borderBottom: '1px solid #333', paddingBottom: '20px' },
    title: { margin: 0, fontSize: '1.8em', fontWeight: 'bold', color: '#fff' },
    subtitle: { margin: 0, color: '#666', fontSize: '0.9em' },
    tabs: { display: 'flex', gap: '5px' },
    rangeSelector: { display: 'flex', gap: '5px', background: '#222', padding: '5px', borderRadius: '5px' },
    rangeBtn: { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '5px 10px', fontSize: '0.8em' },
    rangeBtnActive: { background: '#444', border: 'none', color: '#fff', cursor: 'pointer', padding: '5px 10px', borderRadius: '4px', fontSize: '0.8em', fontWeight: 'bold' },

    apiList: { display: 'flex', flexDirection: 'column', gap: '15px' },
    accordionItem: { border: '1px solid #333', borderRadius: '8px', background: '#1a1a1a', overflow: 'hidden' },
    accordionHeader: { padding: '20px', cursor: 'pointer', background: '#222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    accordionContent: { padding: '20px', background: '#161616', borderTop: '1px solid #333' },
    linkBtn: { textDecoration: 'none', color: '#4ade80', fontSize: '0.8em', border: '1px solid #14532d', padding: '5px 10px', borderRadius: '4px' },

    modelSection: { padding: '10px' },
    h3: { color: '#d4a373', borderLeft: '3px solid #d4a373', paddingLeft: '10px', marginBottom: '20px' },
    kpiRow: { display: 'flex', gap: '20px', marginBottom: '30px' },
    kpi: { background: '#222', padding: '15px', borderRadius: '8px', minWidth: '120px' },
    kpiLabel: { color: '#888', fontSize: '0.8em' },
    kpiValue: { fontSize: '1.5em', fontWeight: 'bold', color: '#fff' },
    chartsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' },
    chartBox: { background: '#222', padding: '15px', borderRadius: '8px' },
    chartTitle: { margin: '0 0 15px 0', fontSize: '0.9em', color: '#aaa', textAlign: 'center' },

    errorSection: { marginTop: '20px', borderTop: '1px solid #333', paddingTop: '10px' },
    errorItem: { color: '#f87171', fontFamily: 'monospace', fontSize: '0.85em', padding: '5px 0' },

    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' },
    card: { background: '#1a1a1a', padding: '20px', borderRadius: '10px', border: '1px solid #333' },

    refreshBtn: {
        background: '#222',
        border: '1px solid #333',
        color: '#fff',
        borderRadius: '50%',
        width: '35px',
        height: '35px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2em',
        transition: 'all 0.2s',
        ':hover': { background: '#333' }
    },
    h4: { marginTop: '20px', marginBottom: '10px', borderBottom: '1px solid #333', paddingBottom: '5px', color: '#ccc' },
};

export default AdminDashboard;
