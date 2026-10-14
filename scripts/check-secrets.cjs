const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const excludedDirectories = new Set(['node_modules', 'build', 'dist', 'coverage', '.git', '.cache', '.recovery-local', 'audit', 'backups', 'dumps', '.idea', '.vscode', '.codex', '.agents', '.aws', '.ssh']);
const tokenPatterns = [
  ['provider token', /\bgsk_[A-Za-z0-9_-]{20,}\b/g],
  ['provider token', /\bAIza[A-Za-z0-9_-]{30,}\b/g],
  ['provider token', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/g],
  ['Git hosting token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,})\b/g],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g],
  ['credential URL', /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|https?):\/\/[^\s/'"<>:]+:[^\s/'"<>@]+@/g],
  ['JWT literal', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}\b/g],
];

function forbiddenPath(file) {
  const normalized = file.replaceAll('\\', '/').toLowerCase();
  const parts = normalized.split('/');
  const base = parts.at(-1);
  return parts.some(part => excludedDirectories.has(part)) ||
    (base.startsWith('.env') && base !== '.env.example') ||
    /\.(?:pem|key|p12|pfx|log|dump|sql|db|sqlite\d*|zip|bak)$/i.test(base) ||
    /^(?:credentials|service-account).*\.json$/i.test(base) ||
    /^(?:\.pnp\.|(?:npm|yarn)-(?:debug|error)\.log)/.test(base) ||
    /(?:\.tsbuildinfo|\.sw[op]|~)$/.test(base) ||
    ['.ds_store', 'thumbs.db', 'desktop.ini', '.npmrc', '.netrc', '.git-credentials', '.gitconfig'].includes(base) ||
    ['project_audit.md', 'server/node'].includes(normalized);
}

function parseEnv(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (/^["']/.test(value)) {
      const quote = value[0];
      const end = value.lastIndexOf(quote);
      value = end > 0 ? value.slice(1, end) : value.slice(1);
    } else value = value.split('#')[0].trim();
    result[match[1]] = value;
  }
  return result;
}

function localSecrets(root) {
  const values = [];
  const reference = path.join(root, '.recovery-local', 'secret-values.json');
  if (fs.existsSync(reference)) values.push(...JSON.parse(fs.readFileSync(reference, 'utf8')));
  for (const folder of ['', 'client', 'server']) {
    const dir = path.join(root, folder);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.toLowerCase().startsWith('.env') || file.toLowerCase() === '.env.example' || !fs.statSync(path.join(dir, file)).isFile()) continue;
      for (const [name, value] of Object.entries(parseEnv(fs.readFileSync(path.join(dir, file), 'utf8')))) {
        if (/KEY|SECRET|PASSWORD|MONGO_URI/i.test(name) && value.length >= 4 && !value.startsWith('replace-with-') && !/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(value)) values.push(value);
      }
    }
  }
  return [...new Set(values.filter(value => typeof value === 'string' && value.length >= 4))];
}

function scanFile(file, bytes, secrets = []) {
  const findings = [];
  const add = (rule, index = 0) => findings.push({ file, line: bytes.subarray(0, index).toString('utf8').split('\n').length, rule });
  if (forbiddenPath(file)) add('forbidden private/generated path');
  for (const secret of secrets) {
    const index = bytes.indexOf(Buffer.from(secret));
    if (index !== -1) add('matches a local secret (value suppressed)', index);
  }
  const text = bytes.toString('utf8');
  for (const [rule, pattern] of tokenPatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) add(rule, Buffer.byteLength(text.slice(0, match.index)));
  }
  // Binary assets are still checked for known secrets and provider tokens above.
  if (!bytes.includes(0)) {
    const assignment = /\b([\w]*(?:password|passwd|admin_?pass|secret|api_?key|access_?token|auth_?token|private_?key)[\w]*)["']?\s*[:=]\s*(["'`])([^"'`\r\n]+)\2/gi;
    for (const match of text.matchAll(assignment)) {
      const value = match[3];
      // This existing unit fixture is mocked and never creates an account.
      const mockedFixture = file === 'server/tests/auth.test.js' && match[1] === 'password' && value === 'password';
      if (!mockedFixture && !value.includes('${') && value.length >= 4 && !/^(?:Bearer |x-auth-token|api[_-]?key)$/i.test(value)) add('hardcoded credential-like assignment', Buffer.byteLength(text.slice(0, match.index)));
    }
    if (file.endsWith('/.env.example') || file === '.env.example') {
      for (const [key, value] of Object.entries(parseEnv(text))) {
        if (/KEY|SECRET|PASSWORD/i.test(key) && value && !value.startsWith('replace-with-')) add('environment template contains a non-placeholder credential');
      }
    }
  }
  return findings;
}

function git(root, args, options = {}) {
  return execFileSync('git', args, { cwd: root, maxBuffer: 256 * 1024 * 1024, ...options });
}

function candidateFiles(root, mode) {
  if (mode === '--worktree') {
    const result = [];
    const walk = (dir, prefix = '') => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = prefix + entry.name;
        if (forbiddenPath(file)) continue;
        if (entry.isSymbolicLink()) throw new Error('Symlinks require manual review.');
        if (entry.isDirectory()) walk(path.join(dir, entry.name), file + '/');
        else result.push({ file, bytes: fs.readFileSync(path.join(dir, entry.name)) });
      }
    };
    walk(root);
    return result;
  }
  const staged = mode === '--staged';
  const listing = git(root, staged ? ['ls-files', '--stage', '-z'] : ['ls-tree', '-r', '-z', '--full-tree', 'HEAD']).toString('utf8');
  const entries = listing.split('\0').filter(Boolean).map(line => {
    const [metadata, file] = line.split('\t');
    const pieces = metadata.split(' ');
    if (!['100644', '100755'].includes(pieces[0]) || (staged && pieces[2] !== '0')) throw new Error('Unsupported Git entry or unresolved merge.');
    return { file, oid: pieces[staged ? 1 : 2] };
  });
  if (!entries.length) throw new Error('No candidate files to scan.');
  const blobs = git(root, ['cat-file', '--batch'], { input: entries.map(entry => entry.oid).join('\n') + '\n' });
  let offset = 0;
  for (const entry of entries) {
    const newline = blobs.indexOf(10, offset);
    const [oid, type, sizeText] = blobs.subarray(offset, newline).toString('ascii').split(' ');
    const size = Number(sizeText);
    if (oid !== entry.oid || type !== 'blob' || !Number.isSafeInteger(size)) throw new Error('Cannot read candidate blob.');
    entry.bytes = blobs.subarray(newline + 1, newline + 1 + size);
    offset = newline + 1 + size + 1;
  }
  return entries;
}

function run(root, mode) {
  const secrets = localSecrets(root);
  const files = candidateFiles(root, mode);
  return { files: files.length, findings: files.flatMap(({ file, bytes }) => scanFile(file, bytes, secrets)) };
}

if (require.main === module) {
  const mode = process.argv[2];
  if (!['--worktree', '--staged', '--head'].includes(mode)) {
    console.error('Usage: node scripts/check-secrets.cjs --worktree|--staged|--head');
    process.exitCode = 2;
  } else {
    try {
      const result = run(path.resolve(__dirname, '..'), mode);
      for (const finding of result.findings) console.error(JSON.stringify(finding));
      console.log(`Secret check ${mode}: ${result.files} files, ${result.findings.length} findings. Values are never printed.`);
      process.exitCode = result.findings.length ? 1 : 0;
    } catch {
      console.error('Secret check could not complete; no commit or push should proceed. Error details suppressed to protect credentials.');
      process.exitCode = 2;
    }
  }
}
module.exports = { forbiddenPath, parseEnv, localSecrets, scanFile, candidateFiles, run };
