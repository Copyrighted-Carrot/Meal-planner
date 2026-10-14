const mongoose = require('mongoose');
const SystemLog = require('./models/SystemLog');
const ErrorLog = require('./models/ErrorLog');
const dotenv = require('dotenv');

dotenv.config();

const cleanDb = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('🧹 Purging all stats...');

        // Delete EVERYTHING to be sure no fake data remains.
        // This is the only way to be 100% honest as requested.
        await SystemLog.deleteMany({});
        await ErrorLog.deleteMany({});

        console.log('✅ Database Cleaned. No logs exist. Starting fresh.');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

cleanDb();
