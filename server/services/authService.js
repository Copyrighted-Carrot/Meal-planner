const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const AppError = require("../utils/AppError");
const logUsage = require("../utils/usageLogger");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
    return { token, user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt } };
};

const login = async ({ email, password }) => {
    const user = await User.findOne({ email });
    if (!user) {
        throw new AppError("User not found", 400); // Specific error per user request
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new AppError("Invalid Credentials", 400);
    }

    // Update Last Login
    user.lastLogin = Date.now();
    await user.save();

    const token = generateToken(user);
    return { token, user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt } };
};

const googleLogin = async (credential) => {
    logUsage('GoogleAuth', 'Login'); // Track Google Usage
    const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { name, email, sub: googleId } = ticket.getPayload();

    let user = await User.findOne({ email });

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
    return { token, user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt } };
};

const getUser = async (userId) => {
    const user = await User.findById(userId).select("-password");
    if (!user) {
        throw new AppError("User not found", 404);
    }
    return user;
};

module.exports = {
    register,
    login,
    googleLogin,
    getUser,
};
