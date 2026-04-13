const { createServer: createHttpServer } = require('http');
const { createServer: createHttpsServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

// --- SMART DOTENV LOADING ---
function loadEnv() {
    const dotenvPath = path.join(__dirname, '.env');
    if (fs.existsSync(dotenvPath)) {
        require('dotenv').config({ path: dotenvPath });
    } else {
        require('dotenv').config();
    }
}

loadEnv();

const isDevEnv = process.env.NODE_ENV !== 'production';
const hasSource = fs.existsSync(path.join(__dirname, 'app')) || fs.existsSync(path.join(__dirname, 'pages'));
const dev = isDevEnv && hasSource;
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '443', 10);
const useHttps = port !== 3000 && process.env.USE_HTTPS !== 'false';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function buildHttpsOptions() {
    const certPath = path.join(__dirname, 'certs');
    if (fs.existsSync(path.join(certPath, 'private.key')) && fs.existsSync(path.join(certPath, 'certificate.crt'))) {
        const opts = {
            key: fs.readFileSync(path.join(certPath, 'private.key')),
            cert: fs.readFileSync(path.join(certPath, 'certificate.crt')),
        };
        if (fs.existsSync(path.join(certPath, 'ca_bundle.crt'))) {
            opts.cert += '\n' + fs.readFileSync(path.join(certPath, 'ca_bundle.crt'));
        }
        return opts;
    }
    return {
        key: fs.readFileSync(path.join(certPath, 'server.key')),
        cert: fs.readFileSync(path.join(certPath, 'server.crt')),
    };
}

function scheduleJob(name, path, intervalMs, apiKey) {
    const http = require(useHttps ? 'https' : 'http');
    const baseUrl = useHttps ? `https://${hostname}:${port}` : `http://localhost:${port}`;

    setInterval(() => {
        const currentKey = process.env[name + '_API_KEY'] || apiKey;
        console.log(`[Job Runner] Executing ${name}...`);

        http.get(`${baseUrl}${path}`, { 
            headers: { 
                'x-internal-job': 'true',
                'x-api-key': currentKey || ''
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => console.log('[Job Runner] %s result:', name, res.statusCode));
        }).on('error', (e) => console.error('[Job Runner] %s error:', name, e.message));
    }, intervalMs);
}

function scheduleDailyJob(name, path, hourUtc, apiKey) {
    const http = require(useHttps ? 'https' : 'http');
    const baseUrl = useHttps ? `https://${hostname}:${port}` : `http://localhost:${port}`;

    const runJob = () => {
        const currentKey = process.env[name + '_API_KEY'] || apiKey;
        console.log(`[Job Runner] Executing daily ${name}...`);
        
        http.get(`${baseUrl}${path}`, { 
            headers: { 
                'x-internal-job': 'true',
                'x-api-key': currentKey || ''
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => console.log('[Job Runner] Daily %s result:', name, res.statusCode));
        }).on('error', (e) => console.error('[Job Runner] Daily %s error:', name, e.message));
        
        setTimeout(scheduleNext, 60000);
    };

    const scheduleNext = () => {
        const now = new Date();
        const nextRun = new Date();
        nextRun.setUTCHours(hourUtc, 0, 0, 0);
        if (nextRun <= now) nextRun.setUTCDate(nextRun.getUTCDate() + 1);
        const delay = nextRun.getTime() - now.getTime();
        console.log(`[Job Runner] Next ${name} at ${nextRun.toISOString()}`);
        setTimeout(runJob, delay);
    };

    scheduleNext();
}

app.prepare().then(() => {
    const requestHandler = async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error handling', req.url, err);
            res.statusCode = 500;
            res.end('error');
        }
    };

    const server = useHttps ? createHttpsServer(buildHttpsOptions(), requestHandler) : createHttpServer(requestHandler);

    server.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on ${useHttps ? 'https' : 'http'}://${hostname}:${port}`);

        scheduleJob('GEOCODE_JOB', '/api/jobs/geocode-locations', 60000, process.env.GEOCODE_JOB_API_KEY);
        scheduleJob('MERGE_JOB', '/api/jobs/merge-location-geocodes', 60000, process.env.MERGE_JOB_API_KEY);
        scheduleDailyJob('DEMO_RESET_JOB', '/api/setup-demo?force=true', 8, process.env.DEMO_RESET_JOB_API_KEY);
    });
});
