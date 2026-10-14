const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const checkStats = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        // 1. Current DB Stats
        const stats = await mongoose.connection.db.stats();
        console.log(`\nconnected to: ${stats.db}`);
        console.log(`Data Size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Storage Size: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);

        // 3. Check for other DBs (Admin privileges required)
        try {
            const admin = mongoose.connection.db.admin();
            const list = await admin.listDatabases();
            console.log("\n--- All Databases on Cluster ---");
            let totalClusterSize = 0;
            list.databases.forEach(db => {
                const sizeMB = db.sizeOnDisk / 1024 / 1024;
                totalClusterSize += sizeMB;
                console.log(`- ${db.name}: ${sizeMB.toFixed(2)} MB`);
            });
            console.log(`Total Cluster Usage: ${totalClusterSize.toFixed(2)} MB`);
        } catch (e) {
            console.log("\n(Could not list other databases - restricted permissions or error)", e.message);
        }

        // 2. Collection Breakdown (Current DB)
        console.log("\n--- Collection Breakdown (Current DB) ---");
        const collections = await mongoose.connection.db.listCollections().toArray();
        for (let col of collections) {
            try {
                // Use aggregation for stats if direct method fails
                const count = await mongoose.connection.db.collection(col.name).countDocuments();
                console.log(`- ${col.name}: ${count} docs`);
            } catch (err) {
                console.log(`- ${col.name}: (Error getting stats)`);
            }
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error);
    }
};

checkStats();
