const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    try {
        const modelResponse = await genAI.getGenerativeModel({ model: "gemini-pro" }).apiKey; // Hack to get instance, but actually we need the manager.
        // Wait, the SDK exposes listModels on the class or no?
        // Actually typically handled via simple fetch or specific method.
        // Let's use the explicit manager if available, or just try a standard fetch to the API endpoint manually to be sure.

        // SDK doesn't always expose listModels easily in the simplified wrapper.
        // Let's assume we can try 'gemini-1.0-pro' since 'gemini-pro' failed.

        // BETTER APPROACH: Just try generating with 'gemini-1.0-pro' directly in this script.

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const result = await model.generateContent("Test");
        console.log("Success with gemini-1.5-flash-latest");

    } catch (error) {
        console.log("Error:", error.message);
    }
}

// Alternative: Use raw fetch to list models
const axios = require('axios');
async function rawList() {
    try {
        const key = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        const res = await axios.get(url);
        console.log("AVAILABLE MODELS (ALL):");
        res.data.models.forEach(m => console.log(`- ${m.name}`));
    } catch (err) {
        console.error("Raw List Error:", err.response ? err.response.data : err.message);
    }
}

rawList();
