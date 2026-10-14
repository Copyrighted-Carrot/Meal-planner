const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { scanFile, forbiddenPath, run } = require('./check-secrets.cjs');

test('detects provider tokens, private keys, credential URLs and JWTs without returning values', () => {
  const samples = [
    ['gsk', '_', 'x'.repeat(40)].join(''),
    ['AIza', 'a'.repeat(35)].join(''),
    ['sk', '-', 'x'.repeat(32)].join(''),
    ['ghp', '_', 'x'.repeat(36)].join(''),
    ['AKIA', 'A'.repeat(16)].join(''),
    ['-----BEGIN ', 'PRIVATE KEY-----'].join(''),
    ['mongodb+srv://', 'sample', ':', 'private-value', '@host/db'].join(''),
    ['eyJ', 'a'.repeat(12), '.', 'b'.repeat(20), '.', 'c'.repeat(30)].join(''),
  ];
  for (const sample of samples) {
    const findings = scanFile('source.js', Buffer.from(sample));
    assert.ok(findings.length > 0);
    assert.equal(JSON.stringify(findings).includes(sample), false);
  }
});

test('detects known local secrets in text and binary assets', () => {
  const value = crypto.randomBytes(24).toString('hex');
  const bytes = Buffer.concat([Buffer.from([0, 255]), Buffer.from(value)]);
  const findings = scanFile('client/src/asset.png', bytes, [value]);
  assert.equal(findings.length, 1);
  assert.equal(JSON.stringify(findings).includes(value), false);
});

test('rejects private/generated paths while allowing environment examples', () => {
  for (const name of ['server/.env', 'client/.env.local', 'server/.ENV', 'client/.Env.local', '.recovery-local/backup.json', 'audit/screenshot.jpg', 'client/node_modules/lib/a.js', 'client/build/main.js', 'server/dumps/db.json', 'key.pem', 'PROJECT_AUDIT.md', '.aws/credentials', '.ssh/config', '.npmrc', '.netrc', 'Desktop.ini', '.pnp.cjs', 'state.tsbuildinfo', 'notes.swp', 'file~', 'npm-debug.log.1']) assert.equal(forbiddenPath(name), true);
  assert.equal(forbiddenPath('server/.env.example'), false);
  assert.equal(forbiddenPath('client/src/assets/carrot.png'), false);
});

test('allows empty/template credentials but rejects real-looking values in templates', () => {
  assert.equal(scanFile('server/.env.example', Buffer.from('JWT_SECRET=replace-with-a-long-random-secret\nGROQ_API_KEY=\n')).length, 0);
  const value = crypto.randomBytes(24).toString('hex');
  assert.ok(scanFile('server/.env.example', Buffer.from('JWT_SECRET=' + value)).length);
});

test('detects hardcoded passwords outside the narrowly identified mocked fixture', () => {
  const fixture = ['password', ': ', "'", 'password', "'"].join('');
  assert.ok(scanFile('server/test_auth.js', Buffer.from(fixture)).length);
  assert.equal(scanFile('server/tests/auth.test.js', Buffer.from(fixture)).length, 0);
  const admin = ['const admin', 'Pass', ' = ', JSON.stringify(crypto.randomBytes(20).toString('hex'))].join('');
  assert.ok(scanFile('server/setup_admin_env.js', Buffer.from(admin)).length);
});

function repository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meal-planner-secret-check-'));
  t.after(() => {
    const target = path.resolve(root);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.ok(path.basename(target).startsWith('meal-planner-secret-check-'));
    fs.rmSync(target, { recursive: true, force: true });
  });
  const git = args => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init', '--quiet']);
  return { root, git };
}

test('scans staged bytes even after a credential is removed from the working file', t => {
  const { root, git } = repository(t);
  fs.mkdirSync(path.join(root, 'server'));
  const value = crypto.randomBytes(30).toString('hex');
  fs.writeFileSync(path.join(root, 'server', '.env'), 'JWT_SECRET=' + value);
  fs.writeFileSync(path.join(root, 'source.js'), 'value: ' + value);
  git(['add', 'source.js']);
  fs.writeFileSync(path.join(root, 'source.js'), '// safe working copy');
  assert.equal(run(root, '--worktree').findings.length, 0);
  assert.ok(run(root, '--staged').findings.some(f => f.rule.startsWith('matches a local secret')));
});

test('rejects forced staging of a private environment file', t => {
  const { root, git } = repository(t);
  fs.writeFileSync(path.join(root, '.env'), 'PORT=5000');
  git(['add', '.env']);
  assert.ok(run(root, '--staged').findings.some(f => f.rule === 'forbidden private/generated path'));
});

test('checks staged files against a private local secret reference', t => {
  const { root, git } = repository(t);
  const value = crypto.randomBytes(24).toString('hex');
  fs.mkdirSync(path.join(root, '.recovery-local'));
  fs.writeFileSync(path.join(root, '.recovery-local', 'secret-values.json'), JSON.stringify([value]));
  fs.writeFileSync(path.join(root, 'source.js'), value);
  git(['add', 'source.js']);
  assert.ok(run(root, '--staged').findings.some(f => f.rule.startsWith('matches a local secret')));
});
