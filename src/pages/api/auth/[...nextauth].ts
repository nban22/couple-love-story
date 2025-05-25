import NextAuth from 'next-auth';
import { authOptions } from '../../../lib/auth';

/**
 * NextAuth handler with error boundaries and logging
 * Centralized authentication endpoint for the application
 */
export default NextAuth(authOptions);