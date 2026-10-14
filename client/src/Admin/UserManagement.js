import React, { useState, useEffect } from 'react';
import { adminApi as axios } from '../utils/api';

const UserManagement = ({ styles }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null); // For Modal
    const [actionLoading, setActionLoading] = useState(false);

    // Form States for Edit
    const [editForm, setEditForm] = useState({
        adminNotes: '',
        suspensionReason: '',
        newPassword: '' // Reset Password
    });

    // --- DOSSIER TABS STATE ---
    const [dossierTab, setDossierTab] = useState('profile');
    const [userDetails, setUserDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const token = sessionStorage.getItem('adminToken');

    const fetchUserDetails = async (userId) => {
        setLoadingDetails(true);
        try {
            const res = await axios.get(`/admin/users/${userId}/details`, {
                headers: { 'x-admin-token': token }
            });
            setUserDetails(res.data);
        } catch (err) {
            console.error("Failed to fetch details", err);
        }
        setLoadingDetails(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/admin/users', {
                headers: { 'x-admin-token': token }
            });
            setUsers(res.data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching users", err);
            setLoading(false);
        }
    };

    const handleAction = async (action, userId) => {
        if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;
        setActionLoading(true);
        try {
            if (action === 'delete') {
                await axios.delete(`/admin/users/${userId}`, {
                    headers: { 'x-admin-token': token }
                });
                alert('User Deleted');
                fetchUsers(); // Refresh
            } else if (action === 'suspend') {
                await axios.put(`/admin/users/${userId}`, {
                    isSuspended: true,
                    suspensionReason: "Admin Action"
                }, { headers: { 'x-admin-token': token } });
                fetchUsers();
            } else if (action === 'activate') {
                await axios.put(`/admin/users/${userId}`, {
                    isSuspended: false
                }, { headers: { 'x-admin-token': token } });
                fetchUsers();
            }
        } catch (err) {
            console.error(err);
            alert("Action Failed");
        }
        setActionLoading(false);
    };

    const handleSaveEdit = async () => {
        setActionLoading(true);
        try {
            await axios.put(`/admin/users/${selectedUser._id}`, {
                adminNotes: editForm.adminNotes,
                suspensionReason: editForm.suspensionReason, // update this if suspended
                password: editForm.newPassword // Only sends if not empty
            }, { headers: { 'x-admin-token': token } });

            alert("User Updated Successfully");
            setSelectedUser(null);
            setEditForm({ adminNotes: '', suspensionReason: '', newPassword: '' });
            fetchUsers();
        } catch (err) {
            console.error(err);
            alert("Update Failed");
        }
        setActionLoading(false);
    };

    const openModal = (user) => {
        setSelectedUser(user);
        setEditForm({
            adminNotes: user.adminNotes || '',
            suspensionReason: user.suspensionReason || '',
            newPassword: ''
        });
        fetchUserDetails(user._id);
        setDossierTab('profile'); // Reset to profile tab
    };

    const handleResetPlans = async () => {
        if (!window.confirm("⚠️ ARMAGEDDON PROTOCOL: This will wipe ALL meal plans for this user. They will have to regenerate. Proceed?")) return;
        setActionLoading(true);
        try {
            await axios.delete(`/admin/users/${selectedUser._id}/plans`, {
                headers: { 'x-admin-token': token }
            });
            alert("Meal Plans Wiped. User is now a blank slate.");
            fetchUserDetails(selectedUser._id); // Refresh details
        } catch (err) {
            console.error(err);
            alert("Reset Failed");
        }
        setActionLoading(false);
    };

    // Calculate Activity Status (User Requested Relative Time)
    const getLastActiveLabel = (user) => {
        const lastDate = user.lastLogin ? new Date(user.lastLogin) : new Date(user.createdAt);
        const now = new Date();
        const diffMs = now - lastDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let label = '';
        let color = '#4ade80'; // Green

        if (diffDays < 1) {
            label = 'Active Today';
            color = '#4ade80';
        } else if (diffDays === 1) {
            label = 'Last seen a day ago';
            color = '#4ade80';
        } else if (diffDays <= 6) {
            label = `${diffDays} days ago`;
            color = '#4ade80';
        } else if (diffDays <= 13) {
            label = '1 week ago';
            color = '#facc15'; // Yellow
        } else if (diffDays <= 29) {
            label = `${Math.floor(diffDays / 7)} weeks ago`;
            color = '#facc15';
        } else if (diffDays <= 30) {
            label = '1 month ago';
            color = '#f59e0b'; // Orange
        } else if (diffDays <= 180) {
            label = `${Math.floor(diffDays / 30)} months ago`;
            color = '#f59e0b';
        } else if (diffDays <= 365) {
            label = `${Math.floor(diffDays / 30)} months ago`;
            color = '#ef4444'; // Red
        } else {
            label = 'Over a year ago';
            color = '#b91c1c'; // Dark Red
        }

        return { label, color, lastDate };
    };

    const filteredUsers = users.filter(u =>
        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div style={{ padding: '20px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>👥 User Cockpit ({users.length})</h2>
                <input
                    type="text"
                    placeholder="Search User..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ padding: '8px', borderRadius: '5px', border: '1px solid #444', background: '#222', color: '#fff', width: '300px' }}
                />
            </div>

            {loading ? <div style={{ textAlign: 'center', padding: '40px' }}>Loading Intelligence...</div> : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden' }}>
                        <thead>
                            <tr style={{ background: '#333', textAlign: 'left' }}>
                                <th style={{ padding: '12px' }}>User</th>
                                <th style={{ padding: '12px' }}>Stats</th>
                                <th style={{ padding: '12px' }}>Health Profile</th>
                                <th style={{ padding: '12px' }}>Engagement</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => {
                                const activity = getLastActiveLabel(user);
                                return (
                                    <tr key={user._id} style={{ borderBottom: '1px solid #333', background: user.isSuspended ? '#2a1a1a' : 'transparent' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 'bold', color: '#fff' }}>{user.name}</div>
                                            <div style={{ fontSize: '0.8em', color: '#888' }}>{user.email}</div>
                                            <div style={{ fontSize: '0.7em', color: '#666' }}>Joined: {new Date(user.createdAt).toLocaleDateString()}</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ color: '#4ade80' }}>🍳 {user.stats?.mealsCreated || 0} Meals</div>
                                            <div style={{ color: '#818cf8' }}>🗓️ {user.stats?.plansGenerated || 0} Plans</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontSize: '0.85em', color: '#ccc' }}>
                                                {user.dietProfile?.diet || 'Standard'}
                                            </div>
                                            {user.dietProfile?.allergies?.length > 0 && (
                                                <div style={{ fontSize: '0.75em', color: '#f87171' }}>
                                                    ⚠️ {user.dietProfile.allergies.join(', ')}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: activity.color }}></div>
                                                <span style={{ fontSize: '0.8em', color: activity.color, fontWeight: 'bold' }}>{activity.label}</span>
                                            </div>
                                            <div style={{ fontSize: '0.7em', color: '#888', marginTop: '4px' }}>
                                                {activity.lastDate.toLocaleDateString()} {activity.lastDate.toLocaleTimeString()}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                            <button onClick={() => openModal(user)} style={{ marginRight: '10px', background: '#3b82f6', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>🗂️ Dossier</button>
                                            {user.isSuspended ? (
                                                <button onClick={() => handleAction('activate', user._id)} style={{ background: '#22c55e', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Unban</button>
                                            ) : (
                                                <button onClick={() => handleAction('suspend', user._id)} style={{ background: '#f59e0b', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Ban</button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* --- THE DOSSIER (TABBED MODAL) --- */}
            {selectedUser && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
                    backdropFilter: 'blur(5px)'
                }}>
                    <div style={{
                        background: '#151515', border: '1px solid #444', borderRadius: '12px',
                        width: '800px', maxWidth: '95%', height: '80vh', display: 'flex', flexDirection: 'column'
                    }}>
                        {/* HEADER */}
                        <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#222', borderRadius: '12px 12px 0 0' }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#fff' }}>📁 Dossier: {selectedUser.name}</h3>
                                <div style={{ fontSize: '0.85em', color: '#888' }}>ID: {selectedUser._id}</div>
                            </div>
                            <button onClick={() => setSelectedUser(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5em', cursor: 'pointer' }}>&times;</button>
                        </div>

                        {/* TABS */}
                        <div style={{ display: 'flex', background: '#111', padding: '10px 20px', gap: '10px', borderBottom: '1px solid #333' }}>
                            {['profile', 'history', 'health', 'danger'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setDossierTab(tab)}
                                    style={{
                                        background: dossierTab === tab ? '#333' : 'transparent',
                                        color: dossierTab === tab ? '#fff' : '#888',
                                        border: '1px solid',
                                        borderColor: dossierTab === tab ? '#555' : 'transparent',
                                        padding: '8px 16px', borderRadius: '6px', cursor: 'pointer',
                                        textTransform: 'capitalize'
                                    }}
                                >
                                    {tab === 'danger' ? '⚠️ Danger Zone' : tab}
                                </button>
                            ))}
                        </div>

                        {/* CONTENT AREA */}
                        <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
                            {loadingDetails ? <div style={{ color: '#888', textAlign: 'center' }}>Decrypting File...</div> : (
                                <>
                                    {/* --- PROFILE TAB --- */}
                                    {dossierTab === 'profile' && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                                            <div>
                                                <h4 style={{ color: '#4ade80', borderBottom: '1px solid #333', paddingBottom: '10px', marginTop: 0 }}>Identity</h4>
                                                <div style={{ marginBottom: '15px' }}>
                                                    <label style={{ display: 'block', color: '#aaa', fontSize: '0.8em' }}>Full Name</label>
                                                    <input disabled value={selectedUser.name} style={{ width: '100%', background: '#222', border: 'none', padding: '10px', color: '#fff', borderRadius: '5px' }} />
                                                </div>
                                                <div style={{ marginBottom: '15px' }}>
                                                    <label style={{ display: 'block', color: '#aaa', fontSize: '0.8em' }}>Email</label>
                                                    <input disabled value={selectedUser.email} style={{ width: '100%', background: '#222', border: 'none', padding: '10px', color: '#fff', borderRadius: '5px' }} />
                                                </div>
                                            </div>
                                            <div>
                                                <h4 style={{ color: '#f59e0b', borderBottom: '1px solid #333', paddingBottom: '10px', marginTop: 0 }}>Administrative Control</h4>
                                                <div style={{ marginBottom: '15px' }}>
                                                    <label style={{ display: 'block', color: '#f87171', fontSize: '0.8em', marginBottom: '5px' }}>
                                                        Reset Password (Manual Override)
                                                    </label>
                                                    <div style={{ fontSize: '0.7em', color: '#aaa', marginBottom: '5px', fontStyle: 'italic' }}>
                                                        🔒 Current password is encrypted and cannot be viewed. Enter a new one below to overwrite it.
                                                    </div>
                                                    <input
                                                        type="text"
                                                        style={{ width: '100%', background: '#111', border: '1px solid #f87171', color: '#fff', padding: '10px', borderRadius: '5px' }}
                                                        value={editForm.newPassword}
                                                        onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                                                        placeholder="Enter new password..."
                                                    />
                                                </div>
                                                <div style={{ marginBottom: '15px' }}>
                                                    <label style={{ display: 'block', color: '#aaa', fontSize: '0.8em' }}>Admin Notes (Private)</label>
                                                    <textarea
                                                        style={{ width: '100%', background: '#111', border: '1px solid #444', color: '#fff', padding: '10px', borderRadius: '5px', minHeight: '80px' }}
                                                        value={editForm.adminNotes}
                                                        onChange={(e) => setEditForm({ ...editForm, adminNotes: e.target.value })}
                                                        placeholder="Internal notes..."
                                                    />
                                                </div>
                                                <button onClick={handleSaveEdit} style={{ width: '100%', background: '#fff', color: '#000', padding: '10px', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Save Notes</button>
                                            </div>
                                        </div>
                                    )}

                                    {/* --- HISTORY TAB --- */}
                                    {dossierTab === 'history' && (
                                        <div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '30px' }}>
                                                <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '2em' }}>🍳</div>
                                                    <div style={{ fontWeight: 'bold', fontSize: '1.2em' }}>{userDetails?.stats?.totalMeals || 0}</div>
                                                    <div style={{ color: '#888', fontSize: '0.8em' }}>Total Meals</div>
                                                </div>
                                                <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '2em' }}>🗓️</div>
                                                    <div style={{ fontWeight: 'bold', fontSize: '1.2em' }}>{userDetails?.stats?.totalPlans || 0}</div>
                                                    <div style={{ color: '#888', fontSize: '0.8em' }}>Plans Generated</div>
                                                </div>
                                                <div style={{ background: '#222', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '2em' }}>🕑</div>
                                                    <div style={{ fontWeight: 'bold', fontSize: '1.2em' }}>{selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleDateString() : 'Never'}</div>
                                                    <div style={{ color: '#888', fontSize: '0.8em' }}>Last Active</div>
                                                </div>
                                            </div>

                                            <h4 style={{ color: '#ccc', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Recent Plans</h4>
                                            {userDetails?.recentPlans?.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {userDetails.recentPlans.map(p => (
                                                        <div key={p._id} style={{ background: '#222', padding: '10px', borderRadius: '5px', display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>Plan from {new Date(p.createdAt).toLocaleDateString()}</span>
                                                            <span style={{ color: '#888' }}>{p.weekStartDate ? new Date(p.weekStartDate).toLocaleDateString() : 'No Start Date'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <div style={{ color: '#666' }}>No recent plans found.</div>}
                                        </div>
                                    )}

                                    {/* --- HEALTH TAB --- */}
                                    {dossierTab === 'health' && (
                                        <div>
                                            <h4 style={{ color: '#818cf8', borderBottom: '1px solid #333', paddingBottom: '10px', marginTop: 0 }}>Dietary Profile</h4>
                                            <div style={{ background: '#222', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                                                <div style={{ marginBottom: '10px' }}>
                                                    <span style={{ color: '#888', marginRight: '10px' }}>Diet Type:</span>
                                                    <span style={{ fontWeight: 'bold', background: '#3b82f6', padding: '2px 8px', borderRadius: '4px' }}>{selectedUser.dietProfile?.diet || 'Standard'}</span>
                                                </div>
                                                <div>
                                                    <span style={{ color: '#888', marginRight: '10px' }}>Allergies:</span>
                                                    {selectedUser.dietProfile?.allergies?.length > 0 ? (
                                                        selectedUser.dietProfile.allergies.map(a => (
                                                            <span key={a} style={{ background: '#b91c1c', color: '#fff', padding: '2px 8px', borderRadius: '4px', marginRight: '5px', fontSize: '0.9em' }}>{a}</span>
                                                        ))
                                                    ) : <span style={{ color: '#666' }}>None Declared</span>}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* --- DANGER ZONE --- */}
                                    {dossierTab === 'danger' && (
                                        <div>
                                            <div style={{ background: '#2a1a1a', border: '1px solid #b91c1c', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                                                <h4 style={{ color: '#f87171', marginTop: 0 }}>☢️ Nuclear Options</h4>

                                                {/* GHOST MODE BUTTON */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #444', paddingBottom: '15px' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', color: '#818cf8' }}>👻 Ghost Mode (Login As User)</div>
                                                        <div style={{ fontSize: '0.8em', color: '#aaa' }}>Impersonate this user to view their dashboard. You will be logged out of Admin.</div>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            if (!window.confirm(`Login as ${selectedUser.name}? You will need to re-login as Admin later.`)) return;
                                                            try {
                                                                const res = await axios.post(`/admin/users/${selectedUser._id}/impersonate`, {}, {
                                                                    headers: { 'x-admin-token': token }
                                                                });
                                                                // HIJACK SESSION
                                                                localStorage.setItem('token', res.data.token);
                                                                // Redirect to User Dashboard
                                                                window.location.href = '/dashboard';
                                                            } catch (err) {
                                                                console.error(err);
                                                                alert("Ghost Mode Initialization Failed");
                                                            }
                                                        }}
                                                        style={{ background: '#818cf8', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                                    >
                                                        👻 Login As {selectedUser.name.split(' ')[0]}
                                                    </button>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #444', paddingBottom: '15px' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', color: '#fff' }}>Reset Meal Plans</div>
                                                        <div style={{ fontSize: '0.8em', color: '#aaa' }}>Wipes all generated plans. Forces user to start fresh.</div>
                                                    </div>
                                                    <button onClick={handleResetPlans} style={{ background: '#f59e0b', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>⚠️ Reset Plans</button>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #444', paddingBottom: '15px' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', color: '#fff' }}>Force Password Change</div>
                                                        <div style={{ fontSize: '0.8em', color: '#aaa' }}>Manually override their password.</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <input
                                                            type="text"
                                                            placeholder="New Password"
                                                            value={editForm.newPassword}
                                                            onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                                                            style={{ background: '#111', border: '1px solid #555', padding: '5px', color: '#fff', borderRadius: '4px' }}
                                                        />
                                                        <button onClick={handleSaveEdit} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Update</button>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', color: '#fff' }}>Delete User</div>
                                                        <div style={{ fontSize: '0.8em', color: '#aaa' }}>Permanent deletion. Cannot be undone.</div>
                                                    </div>
                                                    <button onClick={() => handleAction('delete', selectedUser._id)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️ Delete Permanently</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
