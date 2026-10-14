import fs from 'fs';
import path from 'path';

test('shipped application source has no hardcoded development API address or bypass clients', () => {
    const violations = [];
    const walk = directory => {
        for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
            const filename = path.join(directory, item.name);
            if (item.isDirectory()) walk(filename);
            else if (/\.js$/.test(filename) && !/\.test\.js$/.test(filename) && item.name !== 'setupTests.js') {
                const content = fs.readFileSync(filename, 'utf8');
                if (content.includes(['localhost', ':5000'].join(''))) violations.push(filename);
                if (item.name !== 'api.js' && /from\s+['"]axios['"]/.test(content)) violations.push(filename);
            }
        }
    };
    walk(path.join(process.cwd(), 'src'));
    expect(violations).toEqual([]);
});
