
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    try {
        // Unfortunately standard SDK might not have listModels easily exposed on the instance root in some versions, 
        // but let's try assuming standard Google AI Studio behavior or use a known model that usually works.
        // Actually, for google-generative-ai node package, we might need to rely on documentation or try standard names.

        // Let's try to just test "gemini-1.5-flash-latest" or "gemini-1.0-pro" explicitly if listing is hard.
        // But wait, the error message said: "Call ListModels to see the list".
        // The SDK doesn't always expose this directly in the high level helper.

        // We will try a different approach: Try commonly known valid names in a loop.
        const candidates = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash-001", "gemini-1.0-pro", "gemini-pro-vision"];

        for (const m of candidates) {
            try {
                console.log("Checking " + m);
                const model = genAI.getGenerativeModel({ model: m });
                // Try a dummy generation
                await model.generateContent("Hi");
                console.log("✅ " + m + " is VALID and working.");
            } catch (e) {
                console.log("❌ " + m + " failed: " + e.message.split(":")[0]);
            }
        }

    } catch (e) {
        console.error(e);
    }
}

listModels();
