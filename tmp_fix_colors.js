const fs = require('fs');
const path = require('path');

const srcDir = 'c:\\Users\\pahun\\OneDrive\\Desktop\\LMS CLONE\\src\\app';

const colorMap = {
    'color: #111827;': 'color: var(--text-main, #111827);',
    'color: #0f172a;': 'color: var(--text-main, #0f172a);',
    'color: #1f2937;': 'color: var(--text-main, #1f2937);',
    'color: #374151;': 'color: var(--text-main, #374151);',
    'color: #4b5563;': 'color: var(--text-muted, #4b5563);',
    'color: #6b7280;': 'color: var(--text-muted, #6b7280);',
    'color: #9ca3af;': 'color: var(--text-muted, #9ca3af);',
    'background: #ffffff;': 'background: var(--bg-card, #ffffff);',
    'background-color: #ffffff;': 'background-color: var(--bg-card, #ffffff);',
    'background: #f9fafb;': 'background: var(--bg-hover, #f9fafb);',
    'background-color: #f9fafb;': 'background-color: var(--bg-hover, #f9fafb);',
    'background: #f3f4f6;': 'background: var(--bg-section, #f3f4f6);',
    'background-color: #f3f4f6;': 'background-color: var(--bg-section, #f3f4f6);',
};

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.css') && !fullPath.includes('qr-scanner')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;
            for (const [key, value] of Object.entries(colorMap)) {
                if (content.includes(key)) {
                    content = content.split(key).join(value);
                    changed = true;
                }
            }

            // Also catch ones with flexible spaces or missing semicolons using regex
            // but only the most critical text colors
            const regexes = [
                { regex: /color:\s*#111827/g, replacement: 'color: var(--text-main, #111827)' },
                { regex: /color:\s*#374151/g, replacement: 'color: var(--text-main, #374151)' },
                { regex: /color:\s*#4b5563/g, replacement: 'color: var(--text-muted, #4b5563)' },
                { regex: /color:\s*#6b7280/g, replacement: 'color: var(--text-muted, #6b7280)' },
            ];

            for (const r of regexes) {
                if (r.regex.test(content)) {
                    content = content.replace(r.regex, r.replacement);
                    changed = true;
                }
            }

            if (changed) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated: ${fullPath}`);
            }
        }
    }
}

walkDir(srcDir);
console.log('Done mapping colors.');
