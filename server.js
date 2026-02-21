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
    });
});
