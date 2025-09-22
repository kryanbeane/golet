import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Skip middleware for static files, API routes, and other non-essential paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') || // Skip files with extensions
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return;
  }

  // PRE-LAUNCH MODE: Only allow access to the landing page
  // All other routes are blocked until launch
  const allowedPaths = [
    '/',  // Landing page only
  ];

  const isAllowed = allowedPaths.includes(pathname);
  
  if (!isAllowed) {
    // Redirect all non-allowed paths to the landing page
    return NextResponse.redirect(new URL('/', request.url));
  }

  // No authentication needed for the landing page in pre-launch mode
  return;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
    '/search',
    '/auth',
    '/dashboard',
    '/applications',
    '/listroom',
    '/chat',
    '/account',
    '/profile',
    '/liked',
    '/edit-listing'
  ]
};
