const axios = require('axios');
const crypto = require('node:crypto');

const API_URL = 'http://localhost:5002/api';
const start = Date.now();
const log = (msg, type = 'INFO') => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`[${elapsed}s] ${type}: ${msg}`);
    if (type === 'FAIL') process.exitCode = 1;
};
const statusOf = error => Number.isInteger(error.response?.status) ? error.response.status : 'unavailable';

// This manual check creates users/meals and attempts deletes in the running API.
if (process.env.RUN_LIVE_CHECKS !== 'yes') {
    console.error('Live check skipped. Set RUN_LIVE_CHECKS=yes only against a disposable test database.');
    process.exitCode = 1;
} else {
    runVerification();
}

async function runVerification() {
    console.log('Starting comprehensive manual verification...');
    let tokenA = '';
    let tokenB = '';
    let mealIdA = '';

    // 1. Auth: Success Cases
    try {
        const regRes = await axios.post(`${API_URL}/auth/register`, {
            name: 'User A',
            email: `user-a-${crypto.randomUUID()}@example.invalid`,
            password: crypto.randomBytes(24).toString('hex')
        });
        tokenA = regRes.data.token;
        if (!tokenA) {
            log('Registration response omitted a token.', 'FAIL');
            return;
        }
        log('Auth: Register Success', 'PASS');

        const regResB = await axios.post(`${API_URL}/auth/register`, {
            name: 'User B',
            email: `user-b-${crypto.randomUUID()}@example.invalid`,
            password: crypto.randomBytes(24).toString('hex')
        });
        tokenB = regResB.data.token;
        if (!tokenB) {
            log('Second registration response omitted a token.', 'FAIL');
            return;
        }
        log('Auth: Register User B Success', 'PASS');
    } catch (error) {
        log(`Auth failed (HTTP status: ${statusOf(error)}).`, 'FAIL');
        return;
    }

    // 2. Auth: Negative Cases (Validation)
    try {
        await axios.post(`${API_URL}/auth/register`, {
            email: 'bad-email',
            password: crypto.randomBytes(1).toString('hex')
        });
        log('Auth: Validation Should Fail', 'FAIL');
    } catch (error) {
        if (error.response?.status === 400
            && typeof error.response.data?.message === 'string'
            && error.response.data.message.includes('Validation Error')) {
            log('Auth: Validation Failed Correctly (400)', 'PASS');
        } else {
            log(`Auth: Incorrect Error: ${statusOf(error)}`, 'FAIL');
        }
    }

    const headersA = { headers: { 'x-auth-token': tokenA } };
    const headersB = { headers: { 'x-auth-token': tokenB } };

    // 3. Meals: Success
    try {
        const mealRes = await axios.post(`${API_URL}/meals`, {
            name: 'User A Meal',
            ingredients: ['Rice', 'Beans'],
            category: 'Lunch'
        }, headersA);
        mealIdA = mealRes.data._id;
        if (!mealIdA) {
            log('Meal creation response omitted an ID.', 'FAIL');
            return;
        }
        log('Meals: Create Success', 'PASS');
    } catch (error) {
        log(`Meal creation failed (HTTP status: ${statusOf(error)}).`, 'FAIL');
        return;
    }

    // 4. Ownership Policy (404 check)
    try {
        await axios.delete(`${API_URL}/meals/${mealIdA}`, headersB);
        log("Security: User B deleted User A's meal!", 'FAIL');
    } catch (error) {
        if (error.response?.status === 404) {
            log('Security: Ownership Check Returned 404 (Policy Verified)', 'PASS');
        } else if (error.response?.status === 403) {
            log('Security: Ownership Check Returned 403 (Policy Mismatch - Expected 404)', 'FAIL');
        } else {
            log(`Security: Unexpected Error ${statusOf(error)}`, 'FAIL');
        }
    }

    // 5. Validation Params (ID check)
    try {
        await axios.delete(`${API_URL}/meals/invalid-mongo-id`, headersA);
        log('Validation: Invalid ID should fail', 'FAIL');
    } catch (error) {
        if (error.response?.status === 400
            && typeof error.response.data?.message === 'string'
            && error.response.data.message.includes('Invalid id')) {
            log('Validation: Invalid ID failed correctly (400)', 'PASS');
        } else {
            log(`Validation: Unexpected Error for bad ID: ${statusOf(error)}`, 'FAIL');
        }
    }

    log('Verification complete.');
}
