const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const compareMethods = async () => {
    try {
        console.log("--- 1. CACHED USAGE API ---");
        const usageRes = await cloudinary.api.usage();
        console.log(`Reported Usage: ${(usageRes.storage.usage / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Last Updated: ${usageRes.last_updated}`);

        console.log("\n--- 2. REAL-TIME CALCULATION (Summing Resources) ---");
        let totalBytes = 0;
        let nextCursor = null;
        let fileCount = 0;

        do {
            const res = await cloudinary.api.resources({
                max_results: 500,
                next_cursor: nextCursor,
                resource_type: 'image'
            });

            res.resources.forEach(r => {
                totalBytes += r.bytes;
                fileCount++;
            });
            nextCursor = res.next_cursor;
        } while (nextCursor);

        console.log(`Calculated Usage: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
        console.log(`File Count: ${fileCount}`);

    } catch (error) {
        console.error("Error:", error);
    }
};

compareMethods();
