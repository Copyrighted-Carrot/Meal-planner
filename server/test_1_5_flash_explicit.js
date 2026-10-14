
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testExplicit() {
    // The previously working 2.0 list
    // models/gemini-2.0-flash-exp

    // The problematic ones
    const targets = [
        "gemini-1.5-flash",
        "models/gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "models/gemini-1.5-flash-latest",
        "gemini-1.5-flash-001",
        "models/gemini-1.5-flash-001"
    ];

    console.log("=== Testing 1.5 Flash Variants ===");

    for (const modelName of targets) {
        try {
            process.stdout.write(`Trying [${modelName}] ... `);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello");
            console.log("✅ SUCCESS");
        } catch (error) {
            console.log("❌ FAILED");
            // Log full error structure to see if there's hidden info
            console.log("   Message:", error.message.split('\n')[0]);
            if (error.response) {
                console.log("   Response:", JSON.stringify(error.response, null, 2));
            }
        }
    }
}

testExplicit();
