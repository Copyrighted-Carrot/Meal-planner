const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');

function quoteValue(value) {
    if (typeof value !== 'string' || !value.trim() || /[\r\n\0]/.test(value)) {
        throw new Error('Environment values must be nonempty, single-line strings.');
    }
    // dotenv supports single and backtick quotes without interpreting backslashes.
    for (const quote of ["'", '`']) {
        if (!value.includes(quote)) return `${quote}${value}${quote}`;
    }
    if (!value.includes('"') && !value.includes('\\')) return `"${value}"`;
    throw new Error('Environment value contains unsupported quote combinations.');
}

function needsSecret(value) {
    return !value || !value.trim() || /^(?:<.*>|(?:replace|change)(?:[-_ ].*|me.*)|your[-_ ].*|placeholder|example|todo)$/i.test(value.trim());
}

function updateLocalEnv(envPath, buildUpdates) {
    let content = '';
    try {
        if (fs.lstatSync(envPath).isSymbolicLink()) {
            throw new Error('Refusing to update a symbolic-link environment file.');
        }
        content = fs.readFileSync(envPath, 'utf8');
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    const existing = dotenv.parse(content);
    const updates = buildUpdates(existing);
    const entries = Object.entries(updates);
    if (!entries.length) return { changed: false, keys: [] };

    const replacements = new Map(entries.map(([key, value]) => {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error('Invalid environment variable name.');
        if (/[\r\n]/.test(existing[key] || '')) throw new Error('Multiline existing credentials require a private manual edit.');
        return [key, `${key}=${quoteValue(value)}`];
    }));
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const seen = new Set();
    const lines = content.split(/\r?\n/);
    if (lines[lines.length - 1] === '') lines.pop();
    const nextLines = [];
    for (const line of lines) {
        const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
        if (match && replacements.has(match[1])) {
            const raw = line.slice(line.indexOf('=') + 1).trim();
            if (["'", '"', '`'].includes(raw[0]) && !raw.slice(1).includes(raw[0])) {
                throw new Error('Multiline existing credentials require a private manual edit.');
            }
            if (!seen.has(match[1])) nextLines.push(replacements.get(match[1]));
            seen.add(match[1]);
        } else {
            nextLines.push(line);
        }
    }
    for (const [key, line] of replacements) {
        if (!seen.has(key)) nextLines.push(line);
    }
    const nextContent = `${nextLines.join(eol)}${eol}`;
    if (nextContent === content) return { changed: false, keys: [] };

    const temporaryPath = path.join(path.dirname(envPath), `.env-write-${crypto.randomBytes(12).toString('hex')}.tmp`);
    let descriptor;
    try {
        descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
        fs.writeFileSync(descriptor, nextContent, 'utf8');
        fs.fsyncSync(descriptor);
        fs.closeSync(descriptor);
        descriptor = undefined;
        fs.renameSync(temporaryPath, envPath);
    } finally {
        if (descriptor !== undefined) fs.closeSync(descriptor);
        if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
    return { changed: true, keys: entries.map(([key]) => key) };
}

module.exports = { needsSecret, updateLocalEnv };
