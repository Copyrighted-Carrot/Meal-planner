const SystemLog = require('../models/SystemLog');
const ErrorLog = require('../models/ErrorLog');

/**
 * Logs usage, errors, and data size.
 * @param {string} service - Main Category (Gemini, Groq, USDA, Cloudinary)
 * @param {string} subType - Specific Model or Action (Upload, Delete)
 * @param {string|null} errorMsg - If present, counts as error.
 * @param {number} dataSize - Bytes processed/stored (optional).
 * @param {boolean} isDelete - If true, counts as deletion event.
 */
const logUsage = async (service, subType = 'General', errorMsg = null, dataSize = 0, isDelete = false) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const compositeService = subType === 'General' ? service : `${service}:${subType}`;

        let update = { $set: { lastUpdated: new Date() } };

        if (errorMsg) {
            update.$inc = { errors: 1 };
        } else if (isDelete) {
            update.$inc = { deletedCount: 1 };
        } else {
            update.$inc = { requests: 1, dataUsed: dataSize || 0 };
        }

        // 1. Update Counters
        await SystemLog.findOneAndUpdate(
            { date: today, service: compositeService },
            update,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // 2. Log Specific Error if exists
        if (errorMsg) {
            await ErrorLog.create({
                service,
                model: subType,
                errorMessage: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)
            });
        }
    } catch (err) {
        console.error(`⚠️ Usage Logger Failed:`, err.message);
    }
};

module.exports = logUsage;
