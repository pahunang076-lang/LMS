const fs = require('fs');
const path = require('path');
let count = 0;
function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.html') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;
            
            // Regex to find @for (...) track var
            const regex = /(@for\s*\([^;]+;\s*)track\s+[a-zA-Z0-9_$]+(\s*[;})])/g;
            if (regex.test(content)) {
                content = content.replace(regex, '$1track $$index$2');
                changed = true;
            }
            
            if (changed) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Updated: ' + fullPath);
                count++;
            }
        }
    }
}
walkDir('src/app');
console.log('Track expressions updated: ' + count + ' files.');
