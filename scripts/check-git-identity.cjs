const { execFileSync } = require('node:child_process');
const expected = 'Copyrighted-Carrot <belindosamson@gmail.com>';
try {
  for (const name of ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT']) {
    const actual = execFileSync('git', ['var', name], { encoding: 'utf8' });
    if (!actual.startsWith(expected + ' ')) throw new Error('Identity mismatch');
  }
  console.log('Author and committer match the project owner.');
} catch {
  console.error('Git author and committer must both be Copyrighted-Carrot <belindosamson@gmail.com>.');
  process.exitCode = 1;
}
