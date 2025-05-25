import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';
import type { NextRequest } from 'next/server';

/**
 * Server-side session retrieval utility
 * Provides type-safe session access for API routes and server components
 */
export async function getAuthenticatedUser(req?: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    return session?.user || null;
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return null;
  }
}

/**
 * Authorization guard for API routes
 * Returns standardized error responses for unauthorized access
 */
export function requireAuth() {
  return async function authGuard(req: NextRequest, handler: Function) {
    const user = await getAuthenticatedUser(req);
    
    if (!user) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required',
          code: 'UNAUTHORIZED' 
        }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return handler(req, user);
  };
}

/**
 * Rate limiting utility for authentication endpoints
 * Prevents brute force attacks with sliding window algorithm
 */
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

export function rateLimit(identifier: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
  const now = Date.now();
  const key = `rate_limit_${identifier}`;
  
  const record = rateLimitMap.get(key);
  
  if (!record) {
    rateLimitMap.set(key, { count: 1, timestamp: now });
    return { limited: false, remaining: maxAttempts - 1 };
  }
  
  // Reset window if expired
  if (now - record.timestamp > windowMs) {
    rateLimitMap.set(key, { count: 1, timestamp: now });
    return { limited: false, remaining: maxAttempts - 1 };
  }
  
  // Increment counter
  record.count++;
  
  if (record.count > maxAttempts) {
    return { 
      limited: true, 
      remaining: 0,
      resetTime: record.timestamp + windowMs 
    };
  }
  
  return { 
    limited: false, 
    remaining: maxAttempts - record.count 
  };
}
