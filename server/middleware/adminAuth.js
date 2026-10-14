const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    // 1. Get token from header
    const token = req.header('x-admin-token');

    // 2. Check if no token
    if (!token) {
        return res.status(401).json({ msg: '⛔ Shadow Access Denied. No token.' });
    }

    // 3. Verify token
    try {
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
        req.admin = decoded.admin; // { id: 'admin', role: 'shadow_master' }
        next();
    } catch (err) {
        res.status(401).json({ msg: '⛔ Shadow Access Denied. Invalid token.' });
    }
};
