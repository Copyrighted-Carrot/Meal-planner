const path = require('node:path');
const { updateLocalEnv } = require('./scripts/localEnv.cjs');

// Supply new values through the process environment, never command-line arguments.
// This changes local configuration; revoke old provider keys in the provider console.
try {
    const updates = {};
    for (const provider of ['GROQ', 'OPENAI']) {
        const source = `NEW_${provider}_API_KEY`;
        if (Object.hasOwn(process.env, source)) updates[`${provider}_API_KEY`] = process.env[source];
    }
    if (!Object.keys(updates).length) {
        console.error('Set NEW_GROQ_API_KEY and/or NEW_OPENAI_API_KEY in the process environment first.');
        process.exitCode = 1;
    } else {
        const result = updateLocalEnv(path.join(__dirname, '.env'), () => updates);
        console.log(result.changed ? 'Provided provider keys saved to the local environment file.' : 'Local provider configuration already matches.');
    }
} catch {
    console.error('Provider configuration was not updated. Check the file permissions and nonempty, single-line environment inputs.');
    process.exitCode = 1;
}
