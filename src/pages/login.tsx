import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../lib/auth';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';

/**
 * Login component with comprehensive security measures
 * - CSRF protection via NextAuth
 * - Rate limiting considerations (implement on API level)
 * - Input validation and sanitization
 * - Redirect protection against open redirect vulnerabilities
 */

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  // Secure form submission with comprehensive error handling
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation before API call
    if (!email.trim() || !password.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await signIn('credentials', {
        email: email.toLowerCase().trim(), // Normalize email input
        password,
        redirect: false, // Handle redirect manually for better UX
      });
      
      if (result?.error) {
        // Generic error message to prevent user enumeration
        toast.error('Invalid credentials. Please try again.');
      } else if (result?.ok) {
        toast.success('Login successful! Redirecting...');
        
        // Secure redirect with fallback
        const callbackUrl = (router.query.callbackUrl as string) || '/';
        // Validate callback URL to prevent open redirect attacks
        const isValidCallback = callbackUrl.startsWith('/') && !callbackUrl.startsWith('//');
        
        await router.push(isValidCallback ? callbackUrl : '/');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sign In - Our Love Story</title>
        <meta name="description" content="Sign in to manage your love story" />
        <meta name="robots" content="noindex, nofollow" /> {/* Prevent indexing of login page */}
      </Head>

      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Header with romantic branding */}
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold text-gray-900">
              Welcome Back
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Sign in to your love story
            </p>
          </div>
          
          {/* Login form with accessibility attributes */}
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-pink-500 focus:border-pink-500 disabled:opacity-50"
                  placeholder="Enter your email"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-pink-500 focus:border-pink-500 disabled:opacity-50"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {/* Submit button with loading state */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
            
            {/* Helper text for demo purposes */}
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Demo accounts: couple1@love.story / couple2@love.story<br />
                Password: LoveStory123!
              </p>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/**
 * Redirect authenticated users away from login page
 * Performance: Server-side check eliminates client-side redirect flash
 */
export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  
  if (session) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }
  
  return {
    props: {},
  };
};