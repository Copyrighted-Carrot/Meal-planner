const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
    service: { type: String, required: true }, // e.g., 'Groq', 'Gemini'
    model: { type: String }, // e.g., 'llama-3.3-70b', 'flash-1.5'
    errorMessage: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

// Auto-expire logs after 30 days to save space
errorLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('ErrorLog', errorLogSchema);
