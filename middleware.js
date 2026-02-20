import { NextResponse } from 'next/server';

export function middleware(request) {
    const token = request.cookies.get('auth_token')?.value;
    const { pathname } = request.nextUrl;

    // Paths that don't require authentication
    if (
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/register') ||
        pathname.includes('.') // Static files
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
         * - api/auth (auth endpoints)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
    ],
};
