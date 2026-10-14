const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const AppError = require("../utils/AppError");
const logUsage = require("../utils/usageLogger");
const crypto = require('node:crypto');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const dummyPasswordHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

const publicUser = user => ({
    id: user.id || String(user._id),
    _id: user.id || String(user._id),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    dietProfile: user.dietProfile
});

const generateToken = (user) => {
    return jwt.sign(
        { user: { id: user.id } },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
    );
};

const register = async ({ name, email, password }) => {
    let user = await User.findOne({ email });
    if (user) {
        throw new AppError("User already exists", 400);
    }

    user = new User({ name, email, password });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    const token = generateToken(user);
    // Update Last Login
    user.lastLogin = Date.now();
    await user.save();
    return { token, user: publicUser(user) };
};

const login = async ({ email, password }) => {
    const user = await User.findOne({ email });
    const isMatch = await bcrypt.compare(password, user?.password || dummyPasswordHash);
    if (!user || !user.password || !isMatch) {
        throw new AppError("Invalid Credentials", 401);
    }
    if (user.isSuspended) throw new AppError('Account is suspended', 403);

    // Update Last Login
    user.lastLogin = Date.now();
    await user.save();

    const token = generateToken(user);
    return { token, user: publicUser(user) };
};

const googleLogin = async (credential) => {
    logUsage('GoogleAuth', 'Login'); // Track Google Usage
    let payload;
    try {
        const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
        payload = ticket.getPayload();
    } catch {
        throw new AppError('Invalid Credentials', 401);
    }
    const { name, email, sub: googleId, email_verified: emailVerified } = payload || {};
    if (!email || !googleId || emailVerified !== true) throw new AppError('Invalid Credentials', 401);

    let user = await User.findOne({ email });
    if (user?.isSuspended) throw new AppError('Account is suspended', 403);
    if (user?.googleId && user.googleId !== googleId) throw new AppError('Invalid Credentials', 401);

    if (user) {
        if (!user.googleId) {
            user.googleId = googleId;
            await user.save();
        }
    } else {
        user = new User({
            name,
            email,
            googleId,
            password: "",
        });
        await user.save();
    }

    // Update Last Login
    user.lastLogin = Date.now();
    await user.save();

    const token = generateToken(user);
    return { token, user: publicUser(user) };
};

const getUser = async (userId) => {
    const user = await User.findById(userId).select('name email createdAt dietProfile isSuspended');
    if (!user || user.isSuspended) {
        throw new AppError("Account unavailable. Please sign in again.", 401);
    }
    return publicUser(user);
};

module.exports = {
    register,
    login,
    googleLogin,
    getUser,
};
