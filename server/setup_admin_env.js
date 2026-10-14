const path = require('node:path');
const crypto = require('node:crypto');
const { needsSecret, updateLocalEnv } = require('./scripts/localEnv.cjs');

try {
    const result = updateLocalEnv(path.join(__dirname, '.env'), existing => {
        const updates = {};
        for (const key of ['ADMIN_MASTER_PASSWORD', 'ADMIN_JWT_SECRET']) {
            if (needsSecret(existing[key])) updates[key] = crypto.randomBytes(32).toString('hex');
        }
        return updates;
    });
    console.log(result.changed
        ? 'Missing manager secrets generated and saved locally. Read them only in your private environment file.'
        : 'Existing manager secrets preserved.');
} catch {
    console.error('Manager configuration was not updated. Check local environment file permissions.');
    process.exitCode = 1;
}
