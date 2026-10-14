
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function findWorkingModel() {
    try {
        console.log("Fetching all available models...");
        // Note: SDK usually doesn't expose listModels on the top level easily in all versions, 
        // but let's assume we can get them or just test a massive list.
        // Actually, let's try the listModels if available (it was working in previous test_models.js?)
        // Wait, I saw test_models.js earlier. Let's see if I can reuse its logic but print everything.

        /* 
           If I can't list, I will brute force check these common names.
        */
        const candidates = [
            "gemini-1.5-flash",
            "models/gemini-1.5-flash",
            "gemini-1.5-flash-001",
            "models/gemini-1.5-flash-001",
            "gemini-1.5-flash-002",
            "models/gemini-1.5-flash-002",
            "gemini-1.5-pro",
            "models/gemini-1.5-pro",
            "gemini-1.0-pro",
            "models/gemini-1.0-pro",
            "gemini-pro",
            "models/gemini-2.0-flash-exp",
            "gemini-2.0-flash"
        ];

        console.log(`Checking ${candidates.length} candidates for a working model...`);

        for (const modelName of candidates) {
            try {
                process.stdout.write(`Testing ${modelName} ... `);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Test");
                const response = await result.response;
                console.log("✅ WORKING! (Response: " + response.text().trim() + ")");
            } catch (error) {
                let msg = error.message || "Unknown Error";
                if (msg.includes("404")) msg = "404 Not Found";
                if (msg.includes("429")) msg = "429 Quota Exceeded";
                console.log("❌ Failed: " + msg);
            }
        }

    } catch (e) {
        console.error("Critical script error:", e);
    }
}

findWorkingModel();
