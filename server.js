const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = process.env.PORT || 443;

// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const certPath = path.join(__dirname, 'certs');

let httpsOptions = {};
if (fs.existsSync(path.join(certPath, 'private.key')) && fs.existsSync(path.join(certPath, 'certificate.crt'))) {
    if (fs.existsSync(path.join(certPath, 'ca_bundle.crt'))) {
        httpsOptions = {
            key: fs.readFileSync(path.join(certPath, 'private.key')),
            cert: fs.readFileSync(path.join(certPath, 'certificate.crt')) + '\n' + fs.readFileSync(path.join(certPath, 'ca_bundle.crt'))
        };
    } else {
        httpsOptions = {
            key: fs.readFileSync(path.join(certPath, 'private.key')),
            cert: fs.readFileSync(path.join(certPath, 'certificate.crt'))
        };
    }
} else {
    httpsOptions = {
        key: fs.readFileSync(path.join(certPath, 'server.key')),
        cert: fs.readFileSync(path.join(certPath, 'server.crt'))
    };
}

app.prepare().then(() => {
    createServer(httpsOptions, async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    }).listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on https://${hostname}:${port}`);

        // Run the EXTRACT_POINTS job every 5 minutes (300000 ms)
        setInterval(() => {
            const https = require('https');
            console.log(`[Job Runner] Executing EXTRACT_POINTS...`);

            https.get(`https://${hostname}:${port}/api/jobs/extract-points`, {
                rejectUnauthorized: false // Ignore self-signed certs for internal call
            }, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    console.log(`[Job Runner] EXTRACT_POINTS completed with status ${response.statusCode}:`, data);
                });
            }).on('error', (e) => {
                console.error(`[Job Runner] EXTRACT_POINTS failed:`, e.message);
            });
        }, 5 * 60 * 1000);
    });
});
