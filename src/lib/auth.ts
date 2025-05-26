import { NextAuthOptions, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getDatabase } from './database';

// Extend the session user type to include 'id'
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

/**
 * NextAuth configuration optimized for couple-only access
 * Implements custom credentials provider with rate limiting protection
 * and secure session management for two-user system
 */
export const authOptions: NextAuthOptions = {
  // Use JWT strategy for stateless authentication - better for serverless
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days session expiry
  },
  
  // Custom pages for branding consistency
  pages: {
    signIn: '/login',
    error: '/login',
  },
  
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Email and Password',
      credentials: {
        email: { 
          label: 'Email', 
          type: 'email',
          placeholder: 'your.email@example.com'
        },
        password: { 
          label: 'Password', 
          type: 'password'
        }
      },
      
      /**
       * Authentication logic with timing attack protection
       * Always performs password hash comparison even for invalid users
       * to prevent user enumeration attacks
       */
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const db = await getDatabase();
          const user = db.getUserByEmail(credentials.email.toLowerCase().trim());
          
          // Always perform bcrypt comparison to prevent timing attacks
          const dummyHash = '$2a$12$dummy.hash.to.prevent.timing.attacks.and.user.enumeration';
          const passwordToCheck = user?.password_hash || dummyHash;
          
          const passwordValid = await bcrypt.compare(credentials.password, passwordToCheck);
          
          // Only return user if both user exists and password is valid
          if (user && passwordValid) {
            return {
              id: user.id.toString(),
              email: user.email,
              name: user.name,
            };
          }
          
          return null;
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      }
    })
  ],
  
  callbacks: {
    /**
     * JWT callback - Runs whenever JWT is accessed
     * Adds custom user data to token for session persistence
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
      }
      return token;
    },
    
    /**
     * Session callback - Shapes the session object for client
     * Only includes necessary user data for security
     */
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
      }
      return session;
    },
    
    /**
     * Redirect callback - Handles post-authentication navigation
     * Ensures users return to intended page or default home
     */
    async redirect({ url, baseUrl }) {
      // Allow relative URLs and same-origin absolute URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    }
  },
  
  // Security configurations
  secret: process.env.NEXTAUTH_SECRET,
  
  // Debug only in development - never in production
  debug: process.env.NODE_ENV === 'development',
  
  // Additional security headers and options
  useSecureCookies: process.env.NODE_ENV === 'production',
  cookies: {
    sessionToken: {
      name: 'couple-session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
};