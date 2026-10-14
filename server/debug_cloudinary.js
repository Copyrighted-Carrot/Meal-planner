const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const checkUsage = async () => {
    try {
        console.log("Fetching Cloudinary Usage...");
        const res = await cloudinary.api.usage();
        console.log(JSON.stringify(res, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
};

checkUsage();
