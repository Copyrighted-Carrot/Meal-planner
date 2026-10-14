const crypto = require('node:crypto');

// Unit tests must not inherit local accounts, provider credentials, or databases.
for (const key of Object.keys(process.env)) {
    if (/^(?:MONGO|MONGODB|DATABASE|CLOUDINARY|GEMINI|GROQ|OPENAI|USDA|GOOGLE|ADMIN)_/.test(key)
        || /^NEW_(?:GROQ|OPENAI)_/.test(key)) {
        delete process.env[key];
    }
}
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.PORT = '5003';

// App modules may load dotenv later; keep that from reading the real .env as well.
jest.mock('dotenv', () => ({
    ...jest.requireActual('dotenv'),
    config: jest.fn(() => ({ parsed: {} })),
    configDotenv: jest.fn(() => ({ parsed: {} }))
}));
