const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Meal = require('../models/Meal');
const SystemLog = require('../models/SystemLog');
const ErrorLog = require('../models/ErrorLog');
const adminAuth = require('../middleware/adminAuth');
const cloudinary = require('cloudinary').v2;
const bcrypt = require('bcryptjs'); // Needed for password reset feature

// --- 1. SHADOW LOGIN ---
router.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_MASTER_PASSWORD) {
        const payload = { admin: { id: 'shadow_master', role: 'admin' } };
        jwt.sign(payload, process.env.ADMIN_JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });
    } else {
        return res.status(401).json({ msg: '⛔ Access Denied.' });
    }
});

// --- 2. STATS & HISTORY ---

// GET /api/admin/history
// Query: ?service=Gemini&range=year|month|week
router.get('/history', adminAuth, async (req, res) => {
    try {
        const { service, range } = req.query;
        let regex;

        if (service === 'Groq') regex = /^Groq/; // Match Groq:70b, Groq:8b
        else if (service === 'Gemini') regex = /^Gemini/;
        else regex = new RegExp(`^${service}`);

        const logs = await SystemLog.find({ service: { $regex: regex } }).sort({ date: 1 });

        // Return raw logs, Frontend will filter by date
        res.json(logs);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// GET /api/admin/errors
// Query: ?service=Groq
router.get('/errors', adminAuth, async (req, res) => {
    try {
        const { service } = req.query;
        const errors = await ErrorLog.find({ service })
            .sort({ timestamp: -1 })
            .limit(20); // Last 20 errors
        res.json(errors);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});


// GET /api/admin/stats (Simplified Aggregation)
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // 1. User & Meal Stats
        const userCount = await User.countDocuments();
        const activeUsers = await User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 86400000) } });
        const mealCount = await Meal.countDocuments();
        const globalMeals = await Meal.countDocuments({ isGlobal: true });

        // 2. System Usage (Aggregate distinct keys)
        // We'll return everything for today, frontend separates them.
        const logs = await SystemLog.find({ date: today });

        // Transform to easy object: { "Gemini:Flash": { requests: 10, errors: 0 }, ... }
        const usage = {};
        logs.forEach(log => {
            usage[log.service] = { requests: log.requests, errors: log.errors };
        });

        // 3. Cloudinary
        let cloudinaryUsage = {};
        // 3. Cloudinary (Real-Time Calculation with Caching)
        // CACHE STORE (In-Memory)
        if (!global.cloudinaryCache) {
            global.cloudinaryCache = { data: null, lastUpdated: 0 };
        }

        if (process.env.CLOUDINARY_API_KEY) {
            // "Smart Throttle": 8 seconds. 
            // 3600s / 8s = 450 requests/hour. (Limit is 500).
            // This is the fastest "Real Time" possible on Free Plan.
            const CACHE_DURATION = 8 * 1000;
            const now = Date.now();

            if (global.cloudinaryCache.data && (now - global.cloudinaryCache.lastUpdated < CACHE_DURATION)) {
                // SERVE FROM CACHE
                cloudinaryUsage = global.cloudinaryCache.data;
            } else {
                // FETCH FRESH (Rate Limit Protected)
                try {
                    let totalBytes = 0;
                    let fileCount = 0;

                    const rRes = await cloudinary.api.resources({ max_results: 500, resource_type: 'image' });
                    rRes.resources.forEach(r => { totalBytes += r.bytes; });
                    fileCount = rRes.resources.length;

                    const cRes = await cloudinary.api.usage();
                    const LIMIT_GB = cRes.credits.limit || 25;

                    // Local DB Stats
                    const cloudLogs = await SystemLog.find({ service: { $regex: /^Cloudinary/ } });
                    const lifetimeUploads = cloudLogs.filter(l => l.service.includes('Upload')).reduce((acc, l) => acc + (l.requests || 0), 0);
                    const lifetimeDeletes = cloudLogs.reduce((acc, l) => acc + (l.deletedCount || 0), 0);

                    cloudinaryUsage = {
                        usage: (totalBytes / 1024 / 1024 / 1024).toFixed(4) + ' GB',
                        limit: LIMIT_GB + ' GB',
                        usage_percent: ((totalBytes / (LIMIT_GB * 1024 * 1024 * 1024)) * 100).toFixed(2),

                        bandwidth_usage: (cRes.bandwidth.usage / 1024 / 1024 / 1024).toFixed(4) + ' GB',
                        bandwidth_limit: LIMIT_GB + ' GB',
                        bandwidth_percent: (cRes.bandwidth.credits_usage / cRes.credits.limit * 100).toFixed(2),

                        total_images: fileCount,
                        lifetime_uploads: lifetimeUploads,
                        lifetime_deletes: lifetimeDeletes,
                        plan: cRes.plan,
                        credits_usage: ((totalBytes + cRes.bandwidth.usage) / 1024 / 1024 / 1024).toFixed(4),
                        credits_limit: cRes.credits.limit,
                        credits_percent: (((totalBytes + cRes.bandwidth.usage) / (cRes.credits.limit * 1024 * 1024 * 1024)) * 100).toFixed(2)
                    };

                    // Update Cache
                    global.cloudinaryCache = { data: cloudinaryUsage, lastUpdated: now };

                } catch (e) {
                    console.error("Cloudinary Real-Time Error:", e?.error?.message || e.message);
                    // If rate limited, return cached if available, else error
                    if (global.cloudinaryCache.data) {
                        cloudinaryUsage = global.cloudinaryCache.data;
                    } else {
                        cloudinaryUsage = { error: "API Limit Reached. Retrying..." };
                    }
                }
            }
        }

        // 4. MongoDB Analytics (Cluster-Wide)
        let clusterSizeMB = 0;
        let dbList = [];
        try {
            const admin = mongoose.connection.db.admin();
            const list = await admin.listDatabases();
            // Filter out internal DBs if necessary, but usually quota includes all user DBs.
            // On Atlas M0, 'local' is ignored for quota usually, but we'll sum others.
            // Debug showed 'local' was 6GB, so we MUST exclude it to match the 512MB view.
            dbList = list.databases.filter(db => db.name !== 'local' && db.name !== 'config');
            clusterSizeMB = dbList.reduce((acc, db) => acc + (db.sizeOnDisk / 1024 / 1024), 0);
        } catch (e) {
            console.error("Mongo Cluster List Error:", e);
        }

        const dbStats = await mongoose.connection.db.stats();
        let mongoStats = {
            // App-Specific Stats
            dataSize: (dbStats.dataSize / 1024 / 1024).toFixed(4),
            storageSize: (dbStats.storageSize / 1024 / 1024).toFixed(4),
            indexSize: (dbStats.indexSize / 1024 / 1024).toFixed(4),
            objects: dbStats.objects,

            // Cluster Stats (The real quota usage)
            clusterSize: clusterSizeMB.toFixed(2),
            clusterDetails: dbList.map(d => ({ name: d.name, size: (d.sizeOnDisk / 1024 / 1024).toFixed(2) + ' MB' })),

            avgObjSize: dbStats.avgObjSize?.toFixed(0) + ' B',
            collections: []
        };

        const collections = await mongoose.connection.db.listCollections().toArray();
        for (let col of collections) {
            const count = await mongoose.connection.db.collection(col.name).countDocuments();
            mongoStats.collections.push({ name: col.name, count });
        }

        res.json({
            users: { total: userCount, activeToday: activeUsers },
            meals: { total: mealCount, global: globalMeals },
            usage,
            systemHealth: {
                gemini: process.env.GEMINI_API_KEY ? 'active' : 'inactive',
                groq: process.env.GROQ_API_KEY ? 'active' : 'inactive',
                mongo: 'connected',
            },
            cloudinary: cloudinaryUsage,
            mongo: mongoStats
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- USER & MEAL MANAGEMENT ---


router.post('/global-meals', adminAuth, async (req, res) => {
    // ... same as before ...
    try {
        const newMeal = new Meal({ ...req.body, isGlobal: true });
        await newMeal.save();
        res.json(newMeal);
    } catch (err) { res.status(500).send('Error'); }
});

// GET /api/admin/images (Gallery)
router.get('/images', adminAuth, async (req, res) => {
    try {
        if (!process.env.CLOUDINARY_API_KEY) return res.json([]);

        // Fetch last 100 images
        const { resources } = await cloudinary.api.resources({
            resource_type: 'image',
            max_results: 100,
            direction: 'desc'
        });
        res.json(resources);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching images');
    }
});

// --- 5. USER MANAGEMENT (THE COCKPIT) ---

// GET /api/admin/users
router.get('/users', adminAuth, async (req, res) => {
    try {
        // Fetch all users sorted by last login (active first)
        const users = await User.find().sort({ lastLogin: -1 }).lean();

        // Aggregate Stats for each user
        const enrichedUsers = await Promise.all(users.map(async (user) => {
            const mealCount = await Meal.countDocuments({ user: user._id });
            const planCount = await mongoose.model('WeeklyPlan').countDocuments({ user: user._id });

            return {
                ...user,
                stats: {
                    mealsCreated: mealCount,
                    plansGenerated: planCount
                }
            };
        }));

        res.json(enrichedUsers);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching users');
    }
});

// PUT /api/admin/users/:id (Control Panel)
router.put('/users/:id', adminAuth, async (req, res) => {
    try {
        const { isSuspended, suspensionReason, adminNotes, password } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) return res.status(404).json({ msg: 'User not found' });

        if (typeof isSuspended !== 'undefined') {
            user.isSuspended = isSuspended;
            user.suspensionReason = suspensionReason || "";
        }
        if (typeof adminNotes !== 'undefined') user.adminNotes = adminNotes;

        // Manual Password Reset
        if (password && password.length > 0) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }

        await user.save();
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating user');
    }
});

// DELETE /api/admin/users/:id (The Ban Hammer)
router.delete('/users/:id', adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // Delete all associated data
        await Meal.deleteMany({ user: user._id });
        await mongoose.model('WeeklyPlan').deleteMany({ user: user._id });
        await User.findByIdAndDelete(req.params.id);

        res.json({ msg: 'User and all data permanently deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error deleting user');
    }
});

// --- NEW: USER DOSSIER ENDPOINTS ---

// GET /api/admin/users/:id/details
router.get('/users/:id/details', adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // 1. Last 5 Generated Plans
        const plans = await mongoose.model('WeeklyPlan')
            .find({ user: user._id })
            .sort({ createdAt: -1 })
            .limit(5);

        // 2. Meal History (Recent Meals Saved)
        const meals = await Meal.find({ user: user._id })
            .sort({ createdAt: -1 })
            .limit(10);

        // 3. User Logs/Activity (From SystemLog if we can filter by user - currently SystemLog is global)
        // For now, we use createdAt and lastLogin from user object.

        res.json({
            user,
            recentPlans: plans,
            recentMeals: meals,
            stats: {
                totalMeals: await Meal.countDocuments({ user: user._id }),
                totalPlans: await mongoose.model('WeeklyPlan').countDocuments({ user: user._id })
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching user details');
    }
});

// DELETE /api/admin/users/:id/plans (Reset Meal Plan)
router.delete('/users/:id/plans', adminAuth, async (req, res) => {
    try {
        await mongoose.model('WeeklyPlan').deleteMany({ user: req.params.id });
        res.json({ msg: 'All meal plans wiped for user' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error resetting plans');
    }
});


// POST /api/admin/users/:id/impersonate (Ghost Mode)
router.post('/users/:id/impersonate', adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // Generate a standard User JWT (payload same as authController)
        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET, // Using the USER secret, not Admin secret
            { expiresIn: '1h' }, // Short-lived token for ghost mode
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, name: user.name, role: 'ghost' } });
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).send('Error initializing Ghost Mode');
    }
});

module.exports = router;
