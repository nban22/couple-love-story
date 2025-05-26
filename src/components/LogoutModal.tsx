import React, { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { toast } from 'react-toastify';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string | null;
}

/**
 * Custom Logout Modal Component with Enhanced UX
 * Features:
 * - Smooth animations with CSS transitions
 * - Keyboard navigation support (ESC to close)
 * - Loading states with visual feedback
 * - Accessibility compliance (ARIA labels, focus management)
 * - Error handling with graceful degradation
 * - Consistent with romantic theme styling
 */
export default function LogoutModal({ isOpen, onClose, userName }: LogoutModalProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Enhanced keyboard event handler with proper cleanup
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isLoggingOut) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      
      // Focus management for accessibility
      const modalElement = document.getElementById('logout-modal');
      if (modalElement) {
        modalElement.focus();
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, isLoggingOut]);

  /**
   * Secure logout handler with comprehensive error handling
   * - Prevents double-clicks during logout process
   * - Provides user feedback through toast notifications
   * - Implements graceful error recovery
   */
  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent double execution
    
    setIsLoggingOut(true);
    
    try {
      // Enhanced signOut with callback URL and error handling
      const result = await signOut({ 
        redirect: false, // Handle redirect manually for better UX
        callbackUrl: '/' 
      });
      
      if (result?.url) {
        toast.success('Successfully signed out. Goodbye! 👋', {
          position: 'top-center',
          autoClose: 2000,
          className: 'romantic-toast',
        });
        
        // Small delay for toast visibility before redirect
        setTimeout(() => {
          window.location.href = result.url;
        }, 1000);
      } else {
        // Fallback if no URL returned
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed. Please try again.', {
        position: 'top-center',
        autoClose: 3000,
      });
      setIsLoggingOut(false);
      onClose();
    }
  };

  // Early return if modal should not be displayed
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop with smooth fade-in animation */}
      <div 
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 ${
          isOpen ? 'bg-opacity-50' : 'bg-opacity-0'
        }`}
        onClick={!isLoggingOut ? onClose : undefined}
        aria-hidden="true"
      />
      
      {/* Modal container with scale animation */}
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
        <div
          id="logout-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          aria-describedby="logout-description"
          tabIndex={-1}
          className={`bg-white rounded-2xl shadow-2xl max-w-md w-full mx-auto transform transition-all duration-300 ${
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          } ${isLoggingOut ? 'pointer-events-none' : ''}`}
        >
          {/* Modal header with romantic icon */}
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-pink-100 to-rose-100 mb-4">
              {isLoggingOut ? (
                // Animated loading spinner
                <svg 
                  className="animate-spin h-8 w-8 text-pink-500" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                // Heart-shaped logout icon for romantic theme
                <svg 
                  className="h-8 w-8 text-pink-500" 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              )}
            </div>
            
            <h3 
              id="logout-title" 
              className="text-xl font-semibold text-gray-900 mb-2"
            >
              {isLoggingOut ? 'Signing Out...' : 'See You Soon!'}
            </h3>
            
            <p 
              id="logout-description" 
              className="text-gray-600 text-sm"
            >
              {isLoggingOut 
                ? 'Please wait while we sign you out securely.' 
                : userName 
                  ? `${userName}, are you sure you want to sign out of your love story?` 
                  : 'Are you sure you want to sign out?'
              }
            </p>
          </div>

          {/* Action buttons with enhanced styling */}
          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Cancel button - disabled during logout */}
              <button
                type="button"
                onClick={onClose}
                disabled={isLoggingOut}
                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 border border-gray-200 rounded-lg font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Cancel logout"
              >
                {isLoggingOut ? 'Please wait...' : 'Stay Signed In'}
              </button>
              
              {/* Confirm logout button with loading state */}
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg font-medium hover:from-pink-600 hover:to-rose-600 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-all disabled:opacity-75 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                aria-label="Confirm logout"
              >
                {isLoggingOut ? (
                  <span className="flex items-center justify-center">
                    <svg 
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4"
                      />
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Signing Out...
                  </span>
                ) : (
                  'Sign Out'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}