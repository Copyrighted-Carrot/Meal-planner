const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
        // History is preserved indefinitely for yearly analysis
    },
    service: { type: String, required: true },
    requests: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
    dataUsed: { type: Number, default: 0 }, // Bytes stored
    deletedCount: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
});

// Compound index for fast lookups by date+service
systemLogSchema.index({ date: 1, service: 1 }, { unique: true });

module.exports = mongoose.model('SystemLog', systemLogSchema);
