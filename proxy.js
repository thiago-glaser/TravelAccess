import { NextResponse } from 'next/server';

// Extensions we don't want to count (images, fonts, sourcemaps, etc.)
const SKIP_EXTENSIONS = /\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|map|woff|woff2|ttf|eot|json)$/i;

const INTERNAL_SECRET = process.env.INTERNAL_TRACK_SECRET || 'travel-access-internal';

/**
 * Fire-and-forget usage tracking.
 * Calls the internal track-usage API without blocking the response.
 */
function trackUsage(request, pathname) {
    // Normalize path: remove trailing slash for consistency
    const normalizedPath = pathname.length > 1 && pathname.endsWith('/') 
        ? pathname.slice(0, -1) 
        : pathname;

    // Skip static assets, Next.js internals, and the tracker itself
    if (
        normalizedPath.startsWith('/_next') ||
        normalizedPath.startsWith('/api/internal/track-usage') ||
        SKIP_EXTENSIONS.test(normalizedPath)
    ) {
        return Promise.resolve();
    }

    // Build the internal tracking URL
    // In production environments (like Docker containers behind Nginx), fetching
    // the public external domain from inside the container often fails due to NAT loopback.
    // We explicitly route this internal request to the internal loopback address.
    const port = process.env.PORT || '3000';
    let trackOrigin;

    if (process.env.INTERNAL_TRACK_URL) {
        trackOrigin = process.env.INTERNAL_TRACK_URL;
    } else if (port.toString() === '3000') {
        // Safe to assume Proxy mode: Next.js is listening on internal HTTP 3000
        trackOrigin = 'http://127.0.0.1:3000';
    } else {
        // Fallback safely
        trackOrigin = request.nextUrl.origin;
        if (trackOrigin.includes('localhost') || trackOrigin.includes('127.0.0.1')) {
            trackOrigin = trackOrigin.replace('https:', 'http:');
        }
    }
    
    const trackUrl = new URL('/api/internal/track-usage', trackOrigin);
    
    return fetch(trackUrl.toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET
        },
        body: JSON.stringify({ path: normalizedPath })
    }).then(res => {
        if (!res.ok) {
            console.error(`[proxy] Tracking failed for ${normalizedPath}: ${res.status} ${res.statusText}`);
        }
    }).catch(err => {
        console.error(`[proxy] Tracking error for ${normalizedPath}:`, err.message);
    });
}

export function proxy(request, event) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get('auth_token')?.value;

    // Track every hit. Use event.waitUntil if available to ensure 
    // the fire-and-forget fetch completes in the Edge runtime.
    const trackingPromise = trackUsage(request, pathname);
    if (event && typeof event.waitUntil === 'function') {
        event.waitUntil(trackingPromise);
    }

    // Paths that don't require authentication
    if (
        pathname.startsWith('/api/auth') || 
        pathname.startsWith('/login') ||
        pathname.startsWith('/register') ||
        pathname.startsWith('/verify-email') ||
        pathname.startsWith('/reset-password') ||
        pathname.startsWith('/forgot-password') ||
        pathname.startsWith('/forgot-username') ||
        pathname.startsWith('/delete-account') ||
        pathname.includes('.') 
    ) {
        return NextResponse.next();
    }

    // If no token and trying to access a protected page
    if (!token) {
        if (pathname.startsWith('/api/')) {
            // For API routes, let the route handler check for x-api-key 
            // OR return 401 if we want to be strict.
            // Since we already added x-api-key check in route handlers, 
            // we can let them pass through to handle their own auth.
            return NextResponse.next();
        }

        // For pages, redirect to login
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
