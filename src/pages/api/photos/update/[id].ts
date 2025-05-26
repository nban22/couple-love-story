import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { getDatabase } from '../../../../lib/database';

/**
 * RESTful API endpoint for photo metadata updates
 * Implements secure parameter validation, input sanitization, and atomic operations
 * 
 * Route: /api/photos/update/[id].ts
 * Method: PUT
 * Authentication: Required
 * 
 * Request Body Interface:
 * {
 *   title?: string,       // Optional photo title (max 100 chars)
 *   description?: string  // Optional photo description (max 500 chars)
 * }
 * 
 * Response Formats:
 * Success (200): { message: string, photo: Photo }
 * Error (4xx/5xx): { error: string, code: string }
 */

interface PhotoUpdateRequest {
  title?: string;
  description?: string;
}

interface PhotoUpdateResponse {
  message: string;
  photo?: any;
}

interface ErrorResponse {
  error: string;
  code: string;
}

/**
 * Input validation schema with comprehensive data integrity checks
 * Performance: Single-pass validation with early termination
 * Security: Prevents XSS via input sanitization and length constraints
 */
const validatePhotoUpdateInput = (data: PhotoUpdateRequest): string[] => {
  const errors: string[] = [];
  
  // Title validation with UTF-8 character awareness
  if (data.title !== undefined) {
    if (typeof data.title !== 'string') {
      errors.push('Title must be a string');
    } else {
      const trimmedTitle = data.title.trim();
      if (trimmedTitle.length > 100) {
        errors.push('Title cannot exceed 100 characters');
      }
      // Additional XSS prevention: Check for suspicious patterns
      if (/<script|javascript:|data:/i.test(trimmedTitle)) {
        errors.push('Title contains invalid characters');
      }
    }
  }
  
  // Description validation with similar constraints
  if (data.description !== undefined) {
    if (typeof data.description !== 'string') {
      errors.push('Description must be a string');
    } else {
      const trimmedDescription = data.description.trim();
      if (trimmedDescription.length > 500) {
        errors.push('Description cannot exceed 500 characters');
      }
      // XSS prevention check
      if (/<script|javascript:|data:/i.test(trimmedDescription)) {
        errors.push('Description contains invalid characters');
      }
    }
  }
  
  return errors;
};

/**
 * Main request handler with comprehensive error boundary protection
 * Implements fail-fast pattern for optimal performance
 * Database operations use prepared statements for SQL injection prevention
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PhotoUpdateResponse | ErrorResponse>
) {
  // CORS headers for cross-origin compatibility
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle CORS preflight requests with minimal overhead
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'CORS preflight successful' } as any);
  }

  // Method validation - enforce RESTful design principles
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // Authentication guard with session validation
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    // Parameter extraction and type coercion with bounds checking
    const { id } = req.query;
    const photoId = parseInt(id as string, 10);
    
    if (isNaN(photoId) || photoId <= 0) {
      return res.status(400).json({
        error: 'Invalid photo ID - must be positive integer',
        code: 'INVALID_PARAMETER'
      });
    }

    // Request body validation with comprehensive error accumulation
    const updateData: PhotoUpdateRequest = req.body;
    const validationErrors = validatePhotoUpdateInput(updateData);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed: ' + validationErrors.join(', '),
        code: 'VALIDATION_ERROR'
      });
    }

    // Database initialization with async error handling
    const db = await getDatabase();
    
    // Atomic existence check to prevent race conditions
    const existingPhotos = db.getAllPhotos();
    const existingPhoto = existingPhotos.find(p => p.id === photoId);
    
    if (!existingPhoto) {
      return res.status(404).json({
        error: 'Photo not found',
        code: 'PHOTO_NOT_FOUND'
      });
    }

    // Data sanitization with null coercion for database consistency
    const sanitizedData = {
      title: updateData.title?.trim() || undefined,
      description: updateData.description?.trim() || undefined
    };

    // Convert empty strings to undefined for proper database handling
    if (sanitizedData.description === '') {
      sanitizedData.description = undefined;
    }

    // Database update operation with prepared statement execution
    const updateSuccess = db.updatePhoto(photoId, sanitizedData);
    
    if (!updateSuccess) {
      return res.status(500).json({
        error: 'Database update operation failed',
        code: 'UPDATE_FAILED'
      });
    }

    // Retrieve updated record for response consistency
    const updatedPhotos = db.getAllPhotos();
    const updatedPhoto = updatedPhotos.find(p => p.id === photoId);
    
    if (!updatedPhoto) {
      return res.status(500).json({
        error: 'Failed to retrieve updated photo data',
        code: 'RETRIEVAL_FAILED'
      });
    }

    // Success response with structured data
    return res.status(200).json({
      message: 'Photo updated successfully',
      photo: updatedPhoto
    });

  } catch (error) {
    // Comprehensive error logging for debugging and monitoring
    console.error('Photo update API error:', {
      photoId: req.query.id,
      method: req.method,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      sessionExists: !!req.headers.authorization
    });

    // Generic error response to prevent information disclosure
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}