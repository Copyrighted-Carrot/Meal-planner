const mongoose = require('mongoose');
const SystemLog = require('./models/SystemLog');
const ErrorLog = require('./models/ErrorLog');
const dotenv = require('dotenv');

dotenv.config();

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('🔌 Connected to DB');

        // 1. CLEAR OLD GENERIC LOGS (Optional: keep if you want, but clean start is better for graphs)
        // await SystemLog.deleteMany({}); 

        console.log('🌱 Seeding History...');

        const services = [
            { name: 'Gemini', daily: 15, err: 2 },
            { name: 'Groq:70b-Versatile', daily: 40, err: 5 },
            { name: 'Groq:8b-Instant', daily: 10, err: 0 },
            { name: 'Cloudinary:Upload', daily: 5, err: 0 }
        ];

        const daysToSeed = 30;
        const now = new Date();

        for (let i = 0; i < daysToSeed; i++) {
            const date = new Date();
            date.setDate(now.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            for (const s of services) {
                // Randomize slightly
                const reqs = Math.floor(s.daily * (0.5 + Math.random()));
                const errs = Math.floor(s.err * Math.random());

                await SystemLog.findOneAndUpdate(
                    { date: dateStr, service: s.name },
                    { $set: { requests: reqs, errors: errs } },
                    { upsert: true, new: true }
                );
            }
        }

        // Add some specific errors for "Today"
        await ErrorLog.create({
            service: 'Groq',
            model: '70b-Versatile',
            errorMessage: 'Rate limit exceeded: 14500 RPD',
            timestamp: new Date()
        });

        console.log('✅ History Seeded! Graphs should now be full.');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedData();
