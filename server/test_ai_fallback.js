
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("No API Key found. Exiting.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testFallback() {
    const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-pro"];
    const textChunk = "sugar ½ tsp\noil 1–2 tbsp\nmilk ¾ cup";

    console.log("Testing AI Fallback with input:\n" + textChunk);

    for (const modelName of modelsToTry) {
        try {
            console.log(`\n🤖 Attempting model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });

            const prompt = `
    You are a parsing assistant. Extract ingredients from the following text into a JSON array.
    For each line/item, return an object with: "qty" (string), "unit" (string, lowercase standard unit like 'g','kg','ml','cup', or 'x' if none), and "name" (string, clean ingredient name).
    RETURN ONLY JSON.
    Input Text:
    ${textChunk}
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            console.log("Response Text:", text);

            // Robust JSON Extraction
            const jsonStart = text.indexOf('[');
            const jsonEnd = text.lastIndexOf(']');

            let jsonString = text;
            if (jsonStart !== -1 && jsonEnd !== -1) {
                jsonString = text.substring(jsonStart, jsonEnd + 1);
            } else {
                jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
            }

            const parsed = JSON.parse(jsonString);
            console.log("✅ Success! Parsed JSON:", parsed);
            return; // Success

        } catch (error) {
            console.warn(`⚠️ FAILER (${modelName}):`, error.message);
            if (error.response) console.log(JSON.stringify(error.response, null, 2));
        }
    }
    console.error("❌ All models failed.");
}

testFallback();
