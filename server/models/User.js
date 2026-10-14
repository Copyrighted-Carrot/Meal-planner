const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Optional for Google Auth users
    googleId: { type: String }, // Store Google ID if available
    lastLogin: { type: Date },
    createdAt: { type: Date, default: Date.now },
    // ADMIN CONTROL FIELDS
    isSuspended: { type: Boolean, default: false },
    suspensionReason: { type: String, default: "" },
    adminNotes: { type: String, default: "" },
    // USER PROFILE (Synced from Frontend)
    dietProfile: {
        diet: { type: String, default: "Standard" },
        allergies: { type: [String], default: [] },
        goals: { type: String, default: "" }
    }
});

module.exports = mongoose.model("User", userSchema);
