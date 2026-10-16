const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    const signingSecret = process.env.ADMIN_JWT_SECRET;
    if (typeof signingSecret !== 'string' || !signingSecret.trim()) {
        return res.status(503).json({ msg: 'Manager access is unavailable.' });
    }

    // 1. Get token from header
    const token = req.header('x-admin-token');

    // 2. Check if no token
    if (!token) {
        return res.status(401).json({ msg: '⛔ Shadow Access Denied. No token.' });
    }

    // 3. Verify token
    try {
        const decoded = jwt.verify(token, signingSecret, { algorithms: ['HS256'] });
        if (decoded?.admin?.id !== 'shadow_master' || decoded.admin.role !== 'admin'
            || typeof decoded.exp !== 'number') {
            return res.status(401).json({ msg: '⛔ Shadow Access Denied. Invalid token.' });
        }
        req.admin = { id: decoded.admin.id, role: decoded.admin.role };
        next();
    } catch (err) {
        res.status(401).json({ msg: '⛔ Shadow Access Denied. Invalid token.' });
    }
};
