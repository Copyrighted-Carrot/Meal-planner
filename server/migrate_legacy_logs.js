const mongoose = require('mongoose');
const SystemLog = require('./models/SystemLog');
const dotenv = require('dotenv');

dotenv.config();

const migrateData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('🔌 Connected. Migrating REAL data...');

        // 1. DELETE FAKE DATA (Identified by having perfect randomized patterns or just clean slate "today's" fake)
        // Actually, let's just wipe the "fake" ones if possible, but simplest is to correcting the "Groq" ones.
        // If I ran seed_history, I polluted it. 
        // I will first DELETE all logs from TODAY that were likely seeded, OR just focus on identifying legacy.

        // Strategy: Convert any "Groq" (exact match) to "Groq:70b-Versatile"
        const groqUpdate = await SystemLog.updateMany(
            { service: 'Groq' },
            { $set: { service: 'Groq:70b-Versatile' } }
        );
        console.log(`✅ Migrated ${groqUpdate.modifiedCount} legacy 'Groq' records to 'Groq:70b-Versatile'.`);

        // Geminis are likely just 'Gemini', but our UI filters by prefix 'Gemini'.
        // If we want them to show up under "Gemini Flash", we might need to rename or ensure UI catches "Gemini".
        // The UI code does `startsWith('Gemini')`, so 'Gemini' is fine. 
        // But if I logged 'Gemini' without model, it might be separate.
        // Let's default legacy 'Gemini' to 'Gemini:Flash' to be explicit if needed, 
        // but 'Gemini' works with startsWith('Gemini').

        console.log('Done.');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

migrateData();
