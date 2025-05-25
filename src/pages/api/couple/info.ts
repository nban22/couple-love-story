import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { getDatabase } from '../../../lib/database';

/**
 * RESTful API endpoint for couple information management
 * Implements proper HTTP methods with input validation and error handling
 * Performance: Uses database singleton pattern to minimize connection overhead
 */

interface CoupleInfoRequest {
  male_name?: string;
  female_name?: string;
  love_start_date?: string;
  male_birthday?: string;
  female_birthday?: string;
}

// Input validation schema with regex patterns for data integrity
const VALIDATION_PATTERNS = {
  name: /^[a-zA-ZÀ-ỹ\s]{1,50}$/u, // Unicode support for Vietnamese names
  date: /^\d{4}-\d{2}-\d{2}$/, // ISO date format YYYY-MM-DD
  birthday: /^\d{2}-\d{2}$/, // MM-DD format for recurring birthdays
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS headers for potential future API consumption
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests efficiently
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = getDatabase();

    switch (req.method) {
      case 'GET':
        // Public endpoint - no authentication required for viewing
        // Performance optimization: Direct database query without session validation
        const coupleInfo = db.getCoupleInfo();
        if (!coupleInfo) {
          return res.status(404).json({ 
            error: 'Couple information not found',
            code: 'COUPLE_NOT_FOUND' 
          });
        }
        return res.status(200).json(coupleInfo);

      case 'PUT':
        // Authentication required for modifications
        const session = await getServerSession(req, res, authOptions);
        if (!session) {
          return res.status(401).json({ 
            error: 'Authentication required',
            code: 'UNAUTHORIZED' 
          });
        }

        // Input validation with detailed error messages
        const updateData: CoupleInfoRequest = req.body;
        const validationErrors: string[] = [];

        if (updateData.male_name && !VALIDATION_PATTERNS.name.test(updateData.male_name)) {
          validationErrors.push('Invalid male name format');
        }
        if (updateData.female_name && !VALIDATION_PATTERNS.name.test(updateData.female_name)) {
          validationErrors.push('Invalid female name format');
        }
        if (updateData.love_start_date && !VALIDATION_PATTERNS.date.test(updateData.love_start_date)) {
          validationErrors.push('Invalid love start date format (use YYYY-MM-DD)');
        }
        if (updateData.male_birthday && !VALIDATION_PATTERNS.birthday.test(updateData.male_birthday)) {
          validationErrors.push('Invalid male birthday format (use MM-DD)');
        }
        if (updateData.female_birthday && !VALIDATION_PATTERNS.birthday.test(updateData.female_birthday)) {
          validationErrors.push('Invalid female birthday format (use MM-DD)');
        }

        if (validationErrors.length > 0) {
          return res.status(400).json({ 
            error: 'Validation failed',
            details: validationErrors,
            code: 'VALIDATION_ERROR' 
          });
        }

        // Database update with transaction-like behavior
        const updateSuccess = db.updateCoupleInfo(updateData);
        if (!updateSuccess) {
          return res.status(500).json({ 
            error: 'Failed to update couple information',
            code: 'UPDATE_FAILED' 
          });
        }

        // Return updated data for client synchronization
        const updatedInfo = db.getCoupleInfo();
        return res.status(200).json(updatedInfo);

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'OPTIONS']);
        return res.status(405).json({ 
          error: `Method ${req.method} not allowed`,
          code: 'METHOD_NOT_ALLOWED' 
        });
    }
  } catch (error) {
    console.error('API Error in /api/couple/info:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR' 
    });
  }
}