const axios = require('axios');
const crypto = require('node:crypto');

const API_URL = 'http://localhost:5000/api/auth';

// This manual check creates an account in the configured running API.
if (process.env.RUN_LIVE_CHECKS !== 'yes') {
    console.error('Live check skipped. Set RUN_LIVE_CHECKS=yes only against a disposable test database.');
    process.exitCode = 1;
} else {
    testAuth();
}

async function testAuth() {
    try {
        console.log('Testing registration...');
        const testUser = {
            name: 'Test User',
            email: `test-${crypto.randomUUID()}@example.invalid`,
            password: crypto.randomBytes(24).toString('hex')
        };

        const regRes = await axios.post(`${API_URL}/register`, testUser);
        console.log(regRes.data.token ? 'Registration succeeded.' : 'Registration response did not include a token.');
        if (!regRes.data.token) process.exitCode = 1;
        const token = regRes.data.token;

        console.log('Testing protected route...');
        try {
            const userRes = await axios.get(`${API_URL}/user`, {
                headers: { 'x-auth-token': token }
            });
            const matches = userRes.data.email === testUser.email;
            console.log(matches ? 'Protected route returned the test account.' : 'Protected route account did not match.');
            if (!matches) process.exitCode = 1;
        } catch (error) {
            reportFailure('Protected route', error);
        }

        console.log('Testing login...');
        const loginRes = await axios.post(`${API_URL}/login`, {
            email: testUser.email,
            password: testUser.password
        });
        console.log(loginRes.data.token ? 'Login succeeded.' : 'Login response did not include a token.');
        if (!loginRes.data.token) process.exitCode = 1;
    } catch (error) {
        reportFailure('Authentication check', error);
    }
}

function reportFailure(label, error) {
    const status = Number.isInteger(error.response?.status) ? error.response.status : 'unavailable';
    console.error(`${label} failed (HTTP status: ${status}).`);
    process.exitCode = 1;
}
