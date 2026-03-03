/**
 * instrumentation.js
 *
 * Next.js server instrumentation — runs once at server startup (Node.js runtime only).
 * Patches the global console so every log line is prefixed with an ISO timestamp
 * and a severity tag. Works for both `next dev` and `next start` / Docker.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
    // Only patch in the Node.js runtime (not the Edge runtime)
    if (process.env.NEXT_RUNTIME === 'edge') return;

    const originalMethods = {
        log: console.log.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        debug: console.debug.bind(console),
    };

    const tag = {
        log: 'LOG  ',
        info: 'INFO ',
        warn: 'WARN ',
        error: 'ERROR',
        debug: 'DEBUG',
    };

    for (const [level, original] of Object.entries(originalMethods)) {
        console[level] = (...args) => {
            const ts = new Date().toISOString(); // e.g. 2026-03-03T15:21:00.000Z
            original(`[${ts}] [${tag[level]}]`, ...args);
        };
    }
}
