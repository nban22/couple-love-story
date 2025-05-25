import { withAuth } from 'next-auth/middleware';

/**
 * Middleware to protect authenticated routes
 * Implements automatic redirection for unauthenticated users
 * Uses NextAuth's built-in withAuth wrapper for optimal performance
 */
export default withAuth(
  function middleware(req) {
    // Additional middleware logic can be added here
    // For example: logging, rate limiting, or custom headers
    console.log(`Protected route accessed: ${req.nextUrl.pathname}`);
  },
  {
    callbacks: {
      /**
       * Authorization callback - Determines if user can access route
       * Returns true for any authenticated user (both couple members)
       */
      authorized: ({ token }) => !!token,
    },
  }
);

// Specify which routes require authentication
export const config = {
  matcher: [
    '/admin/:path*',    // Admin routes for couple management
    '/api/couple/:path*', // Couple info API endpoints
    '/api/events/:path*', // Event management APIs
    '/api/photos/:path*', // Photo management APIs
  ],
};
