const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const verifyStats = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ API Connection Successful");

        const admin = mongoose.connection.db.admin();

        // 1. CLUSTER WIDE (What Atlas shows as "Storage")
        const list = await admin.listDatabases();
        console.log("\n--- [REAL-TIME] Cluster Databases ---");
        let totalUserSize_MB = 0;
        list.databases.forEach(db => {
            const sizeMB = db.sizeOnDisk / 1024 / 1024;
            // Mark which ones count towards quota usually
            const isSystem = ['local', 'config', 'admin'].includes(db.name);
            if (!isSystem) totalUserSize_MB += sizeMB;

            console.log(`[${db.name}]`);
            console.log(`   Size On Disk: ${sizeMB.toFixed(2)} MB`);
            console.log(`   Is System DB: ${isSystem}`);
        });

        console.log(`\n>>> Total "User" Storage (Sum of non-system DBs): ${totalUserSize_MB.toFixed(2)} MB`);

        // 2. CURRENT APP DB ('test')
        const stats = await mongoose.connection.db.stats();
        console.log(`\n--- [REAL-TIME] Current DB ('${stats.db}') ---`);
        console.log(`   Data Size (Raw Content): ${(stats.dataSize / 1024 / 1024).toFixed(4)} MB`);
        console.log(`   Storage Size (Compressed): ${(stats.storageSize / 1024 / 1024).toFixed(4)} MB`);
        console.log(`   Index Size: ${(stats.indexSize / 1024 / 1024).toFixed(4)} MB`);
        console.log(`   Objects (Docs): ${stats.objects}`);

        await mongoose.disconnect();
    } catch (error) {
        console.error("Verification Error:", error);
    }
};

verifyStats();
