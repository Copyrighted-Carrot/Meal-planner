const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");
const logUsage = require("./usageLogger");

// --- Configuration & Initialization ---

// 1. GROQ
let groqClient = null;
if (process.env.GROQ_API_KEY) {
    console.log("✅ AI Service: GROQ_API_KEY found.");
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
} else {
    console.warn("⚠️ AI Service: GROQ_API_KEY missing.");
}

// 2. GEMINI
let geminiClient = null;
if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️ AI Service: GEMINI_API_KEY missing.");
} else {
    console.log("✅ AI Service: GEMINI_API_KEY found.");
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// --- Parsing Logic ---

const BASE_SYSTEM_PROMPT = `
You are a precision ingredient parser. Extract ingredients from the user's text into a JSON array.
For each item, return an object with: "qty" (string), "unit" (string, lowercase standard), and "name" (string, clean).

RULES:
1. If NO quantity is specified (e.g. just "Salt"), return { "qty": "", "unit": "x", "name": "Salt" }.
2. If a number IS specified but no unit (e.g. "3 Eggs"), use "unit": "count".
3. Unit MUST be one of: 'g', 'kg', 'ml', 'l', 'tbsp', 'tsp', 'cup', 'spoon', 'glass', 'bowl', 'can', 'count', 'bunch', 'pinch', 'packet', 'handful', 'piece', 'slice'.
4. Normalize inputs: "Litre" -> "l", "Tablespoon" -> "tbsp", "Teaspoon" -> "tsp", "Grams" -> "g".
   - "Chammach" -> "spoon"
   - "Katori" -> "bowl"
   - "Tumbler" -> "cup"
5. Example: "Milk 1L" -> { "qty": "1", "unit": "l", "name": "Milk" }.
6. Example: "2 big onions" -> { "qty": "2", "unit": "count", "name": "Big Onions" }.
7. Treat "a" or "an" as quantity "1" (e.g. "a pinch of salt" -> { "qty": "1", "unit": "pinch", "name": "Salt" }).
   - Also handle post-fix: "Salt a pinch" -> { "qty": "1", "unit": "pinch", "name": "Salt" }.
8. Convert number words to digits: "half"->0.5, "one"->1, "two"->2.
9. ALWAYS return the Singular unit form (e.g. "cups" -> "cup").
10. Handle parenthesis: "Salt (pinch)" -> { "qty": "1", "unit": "pinch", "name": "Salt" }.
11. Vague Quantities:
    - "little salt" -> { "qty": "1", "unit": "pinch", "name": "Salt" }
    - "small bowl" -> { "qty": "0.5", "unit": "bowl", ... }
    - "half a bowl" -> { "qty": "0.5", "unit": "bowl", ... }
    - "half kg" -> { "qty": "500", "unit": "g", ... }
    - "half litre" -> { "qty": "500", "unit": "ml", ... }
12. Handle disordered inputs (Ingredient Unit Qty):
    - "sugar tsp 2" -> { "qty": "2", "unit": "tsp", "name": "Sugar" }
    - "water ml 500" -> { "qty": "500", "unit": "ml", "name": "Water" }
    - "rice cup one" -> { "qty": "1", "unit": "cup", "name": "Rice" }
13. EXTREMELY IMPORTANT: Return quantity EXACTLY as seen for ranges/fractions. 
    - Input: "1-2 tbsp" -> Output: "1-2" (Do not calculate average).
    - Input: "½ cup" -> Output: "½" (Do not convert to 0.5).
    - Input: "1/4 cup" -> Output: "1/4".

RETURN ONLY RAW JSON ARRAY. NO MARKDOWN. NO \`\`\`.
`;

// --- Post-Processing Helper ---
function smartConvertUnits(items) {
    return items.map(item => {
        let { qty, unit, name } = item;

        // 1. Math Parsing (Handle Ranges & Fractions)
        if (qty.includes('-') || qty.includes('–')) { // Hyphen or En-dash
            const parts = qty.split(/[-–]/).map(p => parseFloat(p.trim()));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                qty = ((parts[0] + parts[1]) / 2).toString(); // Average
            }
        } else if (qty.includes('/')) {
            const parts = qty.split('/');
            if (parts.length === 2) {
                const num = parseFloat(parts[0]);
                const dem = parseFloat(parts[1]);
                if (dem !== 0) qty = (num / dem).toString();
            }
        } else {
            // Unicode Fractions
            qty = qty.replace(/½/g, '0.5')
                .replace(/⅓/g, '0.33')
                .replace(/⅔/g, '0.66')
                .replace(/¼/g, '0.25')
                .replace(/¾/g, '0.75')
                .replace(/⅕/g, '0.2')
                .replace(/⅙/g, '0.16')
                .replace(/⅛/g, '0.125');
        }

        // 2. Unit Normalization (Kg <-> g)
        const num = parseFloat(qty);
        if (!isNaN(num)) {
            // Grams <-> Kg
            if (unit === 'g' && num >= 1000) {
                qty = (num / 1000).toString();
                unit = 'kg';
            } else if (unit === 'kg' && num < 1) {
                qty = (num * 1000).toString();
                unit = 'g';
            }
            // mL <-> Liters
            else if (unit === 'ml' && num >= 1000) {
                qty = (num / 1000).toString();
                unit = 'l';
            } else if (unit === 'l' && num < 1) {
                qty = (num * 1000).toString();
                unit = 'ml';
            }
        }
        return { qty, unit, name };
    });
}

// --- Provider Functions ---

async function tryGemini(text) {
    if (!geminiClient) return null;
    const models = ["gemini-flash-latest", "gemini-pro-latest", "gemini-1.5-flash", "gemini-2.0-flash-lite"];

    for (const modelName of models) {
        try {
            console.log(`🔄 AI Attempt: Provider [GEMINI] (Model: ${modelName})...`);
            const model = geminiClient.getGenerativeModel({ model: modelName });

            const result = await model.generateContent(BASE_SYSTEM_PROMPT + "\nINPUT:\n" + text);
            const response = await result.response;
            const jsonStr = extractJson(response.text());

            const data = JSON.parse(jsonStr);
            const processed = smartConvertUnits(data);
            console.log(`✅ AI SUCCESS: Parsed with [GEMINI - ${modelName}]. Items: ${processed.length}`);
            logUsage('Gemini');
            return processed;
        } catch (e) {
            logUsage('Gemini', true);
            const isQuota = e.message.includes('429') || e.message.includes('Quota');
            console.warn(`⚠️ AI FAILURE [GEMINI - ${modelName}]: ${isQuota ? 'QUOTA EXCEEDED' : e.message.substring(0, 50)}`);
            if (isQuota) continue;
        }
    }
    return null;
}

// Separate function for Groq Advanced (70b)
async function tryGroq70b(text) {
    if (!groqClient) return null;
    return await tryGroqModel("llama-3.3-70b-versatile", text, "GROQ-70b");
}

// Separate function for Groq Instant (8b)
async function tryGroq8b(text) {
    if (!groqClient) return null;
    return await tryGroqModel("llama-3.1-8b-instant", text, "GROQ-8b");
}

// Generic Groq Handler
async function tryGroqModel(modelId, text, label) {
    try {
        console.log(`🔄 AI Attempt: Provider [${label}] (Model: ${modelId})...`);

        let completion;
        let quotaMsg = "";

        try {
            const raw = await groqClient.chat.completions.create({
                messages: [{ role: "system", content: BASE_SYSTEM_PROMPT }, { role: "user", content: text }],
                model: modelId, temperature: 0
            }).withResponse();

            completion = raw.data;
            const headers = raw.response.headers;
            const remaining = headers.get('x-ratelimit-remaining-requests');
            const limit = headers.get('x-ratelimit-limit-requests');
            if (remaining) quotaMsg = ` (Quota: ${remaining}/${limit} left)`;

        } catch (innerE) {
            completion = await groqClient.chat.completions.create({
                messages: [{ role: "system", content: BASE_SYSTEM_PROMPT }, { role: "user", content: text }],
                model: modelId, temperature: 0
            });
        }

        const jsonStr = extractJson(completion.choices[0]?.message?.content);
        const data = JSON.parse(jsonStr);
        const processed = smartConvertUnits(data);
        console.log(`✅ AI SUCCESS: Parsed with [${label}]${quotaMsg}. Items: ${processed.length}`);

        // Extract simple model name (70b-Versatile or 8b-Instant)
        const simpleModel = label.includes('70b') ? '70b-Versatile' : '8b-Instant';
        logUsage('Groq', simpleModel);

        return processed;
    } catch (e) {
        const simpleModel = label.includes('70b') ? '70b-Versatile' : '8b-Instant';
        logUsage('Groq', simpleModel, e.message);

        // If 429/Quota, we want to fail gracefully so the chain continues
        const isQuota = e.message.includes('429') || e.message.includes('rate limit');
        console.warn(`⚠️ AI FAILURE [${label}]: ${isQuota ? 'QUOTA EXCEEDED' : e.message}`);
        return null;
    }
}

// --- Helper ---
function extractJson(text) {
    if (!text) return "[]";
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
        return text.substring(start, end + 1);
    }
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

// --- Main Export ---
exports.parseIngredientsWithAI = async (textChunk) => {
    console.log(`🧠 AI Manager: Starting chain for input length ${textChunk.length}`);

    // TIER 1: GEMINI (Best Quality, ~20/day)
    let result = await tryGemini(textChunk);
    if (result) return result;

    // TIER 2: GROQ 70b (High Quality, ~1,000/day)
    result = await tryGroq70b(textChunk);
    if (result) return result;

    // TIER 3: GROQ 8b (Good Quality, ~14,400/day)
    result = await tryGroq8b(textChunk);
    if (result) return result;

    console.error("❌ ALL AI PROVIDERS FAILED.");
    throw new Error("All AI providers (Gemini, Groq) failed.");
};
