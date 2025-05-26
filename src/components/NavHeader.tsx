import { Session } from "next-auth";
import Link from "next/link";
import { useState, useEffect } from "react";
import LogoutModal from "./LogoutModal";

interface NavHeaderProps {
  session?: Session | null;
}

/**
 * Enhanced Navigation Header with Hydration Fix
 * 
 * Critical Fix: Resolves Next.js hydration mismatch error by ensuring
 * server-side and client-side renders produce identical initial HTML.
 * 
 * The hydration issue was caused by accessing window.location.pathname
 * during server-side rendering, which is undefined on server but available
 * on client, leading to different HTML output.
 * 
 * Solution Strategy:
 * 1. Initialize with safe default state that matches server render
 * 2. Use useEffect to update client-side state after hydration
 * 3. Prevent rendering active states until client-side mount is complete
 */
export default function NavHeader({ session }: NavHeaderProps) {
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Hydration-safe state management
  const [activeUrl, setActiveUrl] = useState(""); // Safe default for SSR
  const [isMounted, setIsMounted] = useState(false); // Track client-side mount

  /**
   * Client-side only effect to set active URL after hydration
   * This ensures server and client render the same initial HTML
   */
  useEffect(() => {
    // Set mounted flag to enable active state rendering
    setIsMounted(true);

    // Set actual pathname only after client-side mount
    if (typeof window !== "undefined") {
      setActiveUrl(window.location.pathname);

      // Optional: Listen for route changes if using client-side navigation
      const handleRouteChange = () => {
        setActiveUrl(window.location.pathname);
      };

      // For Next.js router events (if needed)
      // Note: This requires importing { useRouter } from 'next/router'
      // const router = useRouter();
      // router.events.on('routeChangeComplete', handleRouteChange);

      // Cleanup function
      return () => {
        // router.events.off('routeChangeComplete', handleRouteChange);
      };
    }
  }, []);

  /**
   * Safe active route detection that prevents hydration mismatch
   * Returns false during SSR and initial client render to ensure consistency
   */
  const isActive = (url: string): boolean => {
    // Prevent active state calculation until client-side mount
    if (!isMounted || !activeUrl) {
      return false; // Safe default that matches server render
    }

    // Root path exact match
    if (url === '/') {
      return activeUrl === url;
    }

    // Nested path prefix match
    return activeUrl === url || activeUrl.startsWith(url + '/');
  };

  /**
   * Logout modal handlers with proper state management
   */
  const handleLogoutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLogoutModalOpen(true);
  };

  const handleCloseLogoutModal = () => {
    setIsLogoutModalOpen(false);
  };

  return (
    <>
      <nav className="flex justify-between items-center mb-8 bg-white/70 backdrop-blur-sm rounded-xl p-4 shadow-sm max-sm:flex-col max-sm:gap-6">
        {/* Navigation Links Section */}
        <div className="flex space-x-6">
          <Link
            href="/"
            passHref
            replace
            legacyBehavior
          >
            <a
              className={`relative px-3 py-2 rounded-lg font-medium transition-all duration-200 ${isActive('/')
                  ? 'text-pink-700 bg-pink-50 shadow-sm'
                  : 'text-gray-600 hover:text-pink-700 hover:bg-pink-25'
                }`}
              aria-current={isActive('/') ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                window.location.href = '/';
              }}
            >
              Home
              {/* Active indicator dot - only show when mounted and active */}
              {isMounted && isActive('/') && (
                <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-pink-500 rounded-full" />
              )}
            </a>
          </Link>

          <Link
            href="/gallery"
            passHref
            replace
            legacyBehavior
          >
            <a
              className={`relative px-3 py-2 rounded-lg font-medium transition-all duration-200 ${isActive('/gallery')
                  ? 'text-pink-700 bg-pink-50 shadow-sm'
                  : 'text-gray-600 hover:text-pink-700 hover:bg-pink-25'
                }`}
              aria-current={isActive('/gallery') ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                window.location.href = '/gallery';
              }}
            >
              Gallery
              {/* Active indicator dot - only show when mounted and active */}
              {isMounted && isActive('/gallery') && (
                <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-pink-500 rounded-full" />
              )}
            </a>
          </Link>

          {/* Events link - uncomment when ready */}

          {/* <Link
            href="/events"
            passHref
            replace
            legacyBehavior
          >
            <a
              className={`relative px-3 py-2 rounded-lg font-medium transition-all duration-200 ${isActive('/events')
                  ? 'text-pink-700 bg-pink-50 shadow-sm'
                  : 'text-gray-600 hover:text-pink-700 hover:bg-pink-25'
                }`}
              aria-current={isActive('/events') ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                window.location.href = '/events';
              }}
            >
              Events
              {isMounted && isActive('/events') && (
                <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-pink-500 rounded-full" />
              )}
            </a>
          </Link> */}
        </div>

        {/* Authentication Section */}
        <div className="flex items-center space-x-4">
          {session ? (
            <>
              {/* Welcome message with improved typography */}
              <span className="text-sm text-gray-600 font-medium hidden sm:inline-block">
                Welcome, <span className="text-pink-600">{session.user?.name}</span>
              </span>

              {/* Mobile welcome message */}
              <span className="text-sm text-gray-600 font-medium sm:hidden">
                Hi, {session.user?.name}!
              </span>

              {/* Enhanced Sign Out Button */}
              <button
                onClick={handleLogoutClick}
                className="group relative text-sm bg-gradient-to-r from-pink-100 to-rose-100 text-pink-600 px-4 py-2 rounded-lg font-medium hover:from-pink-200 hover:to-rose-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 active:scale-95"
                aria-label="Sign out of your account"
              >
                <span className="flex items-center space-x-2">
                  {/* Logout icon */}
                  <svg
                    className="w-4 h-4 transition-transform group-hover:rotate-12"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  <span>Sign Out</span>
                </span>

                {/* Subtle glow effect on hover */}
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-pink-400 to-rose-400 opacity-0 group-hover:opacity-10 transition-opacity duration-200" />
              </button>
            </>
          ) : (
            /* Enhanced Sign In Button for non-authenticated users */
            <Link
              href="/login"
              className="group relative text-sm bg-gradient-to-r from-pink-500 to-rose-500 text-white px-6 py-2.5 rounded-lg font-medium hover:from-pink-600 hover:to-rose-600 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
              aria-label="Sign in to your account"
            >
              <span className="flex items-center space-x-2">
                {/* Login icon */}
                <svg
                  className="w-4 h-4 transition-transform group-hover:-rotate-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                <span>Sign In</span>
              </span>

              {/* Subtle glow effect */}
              <div className="absolute inset-0 rounded-lg bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-200" />
            </Link>
          )}
        </div>
      </nav>

      {/* Custom Logout Modal */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={handleCloseLogoutModal}
        userName={session?.user?.name}
      />
    </>
  );
}