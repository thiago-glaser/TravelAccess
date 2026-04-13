const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let updated = false;

            // Remove .padEnd(36, " ") and .padEnd(36, ' ')
            const regex = /\.padEnd\(36,\s*["'] ["']\)/g;
            if (regex.test(content)) {
                content = content.replace(regex, '');
                updated = true;
            }

            if (updated) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed:', fullPath);
            }
        }
    }
}

processDir(path.join(__dirname, 'app/api'));
