const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { needsSecret, updateLocalEnv } = require('../server/scripts/localEnv.cjs');
const serverRequire = createRequire(path.join(__dirname, '../server/package.json'));
const dotenv = serverRequire('dotenv');

function withEnvironment(callback) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meal-planner-local-env-'));
    const filename = path.join(directory, '.env');
    try {
        callback(filename, directory);
    } finally {
        // Only remove files in this exact temporary directory; never recurse.
        for (const entry of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, entry));
        fs.rmdirSync(directory);
    }
}

function runHelper(filename, directory, environment = {}) {
    const messages = [];
    const fakeProcess = { env: { ...environment }, exitCode: 0 };
    const scriptPath = path.join(__dirname, '../server', filename);
    vm.runInNewContext(fs.readFileSync(scriptPath, 'utf8'), {
        require: createRequire(scriptPath),
        __dirname: directory,
        process: fakeProcess,
        console: {
            log: (...parts) => messages.push(parts.join(' ')),
            error: (...parts) => messages.push(parts.join(' '))
        }
    }, { filename });
    return { messages: messages.join('\n'), exitCode: fakeProcess.exitCode };
}

test('upsert preserves unrelated lines, comments, key prefixes and CRLF', () => {
    withEnvironment(filename => {
        const original = '# Example settings\r\nOTHER=value\r\nGROQ_API_KEY_BACKUP=keep\r\nexport GROQ_API_KEY=old-fixture\r\nGROQ_API_KEY=duplicate-fixture\r\n';
        const replacement = crypto.randomBytes(24).toString('hex');
        fs.writeFileSync(filename, original);
        updateLocalEnv(filename, () => ({ GROQ_API_KEY: replacement }));
        const result = fs.readFileSync(filename, 'utf8');
        assert.ok(result.startsWith('# Example settings\r\nOTHER=value\r\nGROQ_API_KEY_BACKUP=keep\r\n'));
        assert.equal(dotenv.parse(result).GROQ_API_KEY, replacement);
        assert.equal(result.match(/^GROQ_API_KEY=/gm).length, 1);
        assert.equal(result.replace(/\r\n/g, '').includes('\n'), false);
    });
});

test('unsafe input is rejected before changing the file', () => {
    withEnvironment((filename, directory) => {
        const original = 'OTHER=value\n';
        fs.writeFileSync(filename, original);
        for (const unsafe of ['', '   ', 'first\nSECOND=value', 'first\rsecond', 'first\0second']) {
            assert.throws(() => updateLocalEnv(filename, () => ({ GROQ_API_KEY: unsafe })));
            assert.equal(fs.readFileSync(filename, 'utf8'), original);
        }
        assert.throws(() => updateLocalEnv(filename, () => ({ 'INVALID\nNAME': 'fixture' })));
        assert.deepEqual(fs.readdirSync(directory), ['.env']);
    });
});

test('quoted values round-trip and temporary writer files are removed', () => {
    withEnvironment((filename, directory) => {
        const value = "a fixture's # value with spaces and \\n literal";
        updateLocalEnv(filename, () => ({ FIXTURE_VALUE: value }));
        assert.equal(dotenv.parse(fs.readFileSync(filename)).FIXTURE_VALUE, value);
        assert.deepEqual(fs.readdirSync(directory), ['.env']);
    });
});

test('placeholders are identified without replacing existing secrets', () => {
    for (const value of [undefined, '', ' ', '<placeholder>', 'replace-with-generated-secret', 'change-me', 'YOUR_VALUE', 'placeholder']) {
        assert.equal(needsSecret(value), true);
    }
    assert.equal(needsSecret(crypto.randomBytes(32).toString('hex')), false);
});

test('provider helper requires explicit inputs and never writes/logs omitted secrets', () => {
    withEnvironment((filename, directory) => {
        const omitted = runHelper('update_keys.js', directory);
        assert.equal(omitted.exitCode, 1);
        assert.equal(fs.existsSync(filename), false);

        const value = crypto.randomBytes(24).toString('hex');
        const initial = 'OTHER=value\nOPENAI_API_KEY=untouched-fixture\n';
        fs.writeFileSync(filename, initial);
        const result = runHelper('update_keys.js', directory, { NEW_GROQ_API_KEY: value });
        assert.equal(result.exitCode, 0);
        const parsed = dotenv.parse(fs.readFileSync(filename));
        assert.equal(parsed.GROQ_API_KEY, value);
        assert.equal(parsed.OPENAI_API_KEY, 'untouched-fixture');
        assert.equal(result.messages.includes(value), false);
        const before = fs.readFileSync(filename, 'utf8');
        const rejected = runHelper('update_keys.js', directory, { NEW_OPENAI_API_KEY: ['bad', '\n', 'input'].join('') });
        assert.equal(rejected.exitCode, 1);
        assert.equal(fs.readFileSync(filename, 'utf8'), before);
    });
});

test('existing multiline credentials are rejected without leaving fragments behind', () => {
    withEnvironment(filename => {
        for (const suffix of ['', 'GROQ_API_KEY=duplicate-fixture\n']) {
            const original = ['GROQ_API', '_KEY', '=', '"first\nsecond"\nOTHER=value\n', suffix].join('');
            fs.writeFileSync(filename, original);
            assert.throws(() => updateLocalEnv(filename, () => ({ GROQ_API_KEY: crypto.randomBytes(24).toString('hex') })));
            assert.equal(fs.readFileSync(filename, 'utf8'), original);
        }
    });
});

test('manager helper generates missing secrets, preserves existing values and logs no secret', () => {
    withEnvironment((filename, directory) => {
        const existing = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(filename, `ADMIN_MASTER_PASSWORD='${existing}'\nADMIN_JWT_SECRET=<placeholder>\nOTHER=value\n`);
        const first = runHelper('setup_admin_env.js', directory);
        const parsed = dotenv.parse(fs.readFileSync(filename));
        assert.equal(first.exitCode, 0);
        assert.equal(parsed.ADMIN_MASTER_PASSWORD, existing);
        assert.match(parsed.ADMIN_JWT_SECRET, /^[a-f0-9]{64}$/);
        assert.equal(first.messages.includes(existing), false);
        assert.equal(first.messages.includes(parsed.ADMIN_JWT_SECRET), false);
        const before = fs.readFileSync(filename, 'utf8');
        const second = runHelper('setup_admin_env.js', directory);
        assert.equal(second.exitCode, 0);
        assert.equal(fs.readFileSync(filename, 'utf8'), before);
    });
});

test('manual API checks require opt-in before making requests', () => {
    for (const filename of ['test_auth.js', 'verify_all.js']) {
        let requests = 0;
        const fakeProcess = { env: {}, exitCode: 0 };
        const scriptPath = path.join(__dirname, '../server', filename);
        const localRequire = createRequire(scriptPath);
        vm.runInNewContext(fs.readFileSync(scriptPath, 'utf8'), {
            require: name => name === 'axios'
                ? { post: () => { requests++; }, get: () => { requests++; }, delete: () => { requests++; } }
                : localRequire(name),
            process: fakeProcess,
            console: { log() {}, error() {} }
        }, { filename });
        assert.equal(fakeProcess.exitCode, 1);
        assert.equal(requests, 0);
    }
});
