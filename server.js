const { createServer: createHttpServer } = require('http');
const { createServer: createHttpsServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';

// When running behind the Nginx proxy (PORT=3000) we serve plain HTTP.
// When running standalone (PORT=443 or unset) we serve HTTPS as before.
const port = parseInt(process.env.PORT || '443', 10);
const useHttps = port !== 3000 && process.env.USE_HTTPS !== 'false';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ── HTTPS cert resolution (only needed in standalone / legacy mode) ──────────
function buildHttpsOptions() {
    const certPath = path.join(__dirname, 'certs');
    if (
        fs.existsSync(path.join(certPath, 'private.key')) &&
        fs.existsSync(path.join(certPath, 'certificate.crt'))
    ) {
        const opts = {
            key: fs.readFileSync(path.join(certPath, 'private.key')),
            cert: fs.readFileSync(path.join(certPath, 'certificate.crt')),
        };
        if (fs.existsSync(path.join(certPath, 'ca_bundle.crt'))) {
            opts.cert += '\n' + fs.readFileSync(path.join(certPath, 'ca_bundle.crt'));
        }
        return opts;
    }
    // Fall back to self-signed
    return {
        key: fs.readFileSync(path.join(certPath, 'server.key')),
        cert: fs.readFileSync(path.join(certPath, 'server.crt')),
    };
}

// ── Internal job runner ──────────────────────────────────────────────────────
function scheduleJob(name, path, intervalMs) {
    const http = require(useHttps ? 'https' : 'http');
    const baseUrl = useHttps
        ? `https://${hostname}:${port}`
        : `http://localhost:${port}`;

    setInterval(() => {
        console.log(`[Job Runner] Executing ${name}...`);
        http.get(`${baseUrl}${path}`, { 
            rejectUnauthorized: false,
            headers: { 'x-internal-job': 'true' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () =>
                console.log(`[Job Runner] ${name} completed with status ${res.statusCode}:`, data)
            );
        }).on('error', (e) => {
            console.error(`[Job Runner] ${name} failed:`, e.message);
        });
    }, intervalMs);
}

function scheduleDailyJob(name, path, hourUtc) {
    const http = require(useHttps ? 'https' : 'http');
    const baseUrl = useHttps
        ? `https://${hostname}:${port}`
        : `http://localhost:${port}`;

    const runJob = () => {
        console.log(`[Job Runner] Executing daily job ${name}...`);
        http.get(`${baseUrl}${path}`, { 
            rejectUnauthorized: false,
            headers: { 'x-internal-job': 'true' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () =>
                console.log(`[Job Runner] Daily job ${name} completed with status ${res.statusCode}:`, data)
            );
        }).on('error', (e) => {
            console.error(`[Job Runner] Daily job ${name} failed:`, e.message);
        });
        
        // Schedule next run
        setTimeout(scheduleNext, 60000); // Wait 1 minute before scheduling next to avoid immediate re-trigger
    };

    const scheduleNext = () => {
        const now = new Date();
        const nextRun = new Date();
        nextRun.setUTCHours(hourUtc, 0, 0, 0);
        
        if (nextRun <= now) {
            nextRun.setUTCDate(nextRun.getUTCDate() + 1);
        }
        
        const delay = nextRun.getTime() - now.getTime();
        console.log(`[Job Runner] Scheduled ${name} for ${nextRun.toISOString()} (in ${Math.round(delay/1000/60)} minutes)`);
        setTimeout(runJob, delay);
    };

    scheduleNext();
}

// ── Start ────────────────────────────────────────────────────────────────────
app.prepare().then(() => {
    const requestHandler = async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    };

    const server = useHttps
        ? createHttpsServer(buildHttpsOptions(), requestHandler)
        : createHttpServer(requestHandler);

    server.listen(port, (err) => {
        if (err) throw err;
        const proto = useHttps ? 'https' : 'http';
        console.log(`> Ready on ${proto}://${hostname}:${port}`);

        // Background jobs

        scheduleJob('GEOCODE_PENDING_LOCATIONS', '/api/jobs/geocode-locations', 1 * 60 * 1000);
        scheduleJob('MERGE_LOCATION_GEOCODES_JOB', '/api/jobs/merge-location-geocodes', 1 * 60 * 1000);
        scheduleDailyJob('DAILY_DEMO_RESET', '/api/setup-demo?force=true', 8);
    });
});
