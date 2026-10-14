
const axios = require('axios');
require("dotenv").config();

async function testV1() {
    const key = process.env.GEMINI_API_KEY;
    console.log("Testing REST API (v1) for gemini-1.5-flash...");

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${key}`;

    const body = {
        contents: [{
            parts: [{ text: "Extract ingredients from: 1 cup rice" }]
        }]
    };

    try {
        const res = await axios.post(url, body);
        console.log("✅ v1 SUCCESS! Status:", res.status);
        console.log("Response:", JSON.stringify(res.data, null, 2));
    } catch (error) {
        console.log("❌ v1 FAILED");
        if (error.response) {
            console.log("Status:", error.response.status);
            console.log("Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.log("Error:", error.message);
        }
    }
}

testV1();
