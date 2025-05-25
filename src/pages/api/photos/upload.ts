import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { getDatabase } from '../../../lib/database';
import { deleteFromCloudinary, uploadToCloudinary } from '../../../lib/cloudinary';
import multer from 'multer';
import { promisify } from 'util';

/**
 * Multer configuration for memory storage (serverless-friendly)
 * File size limits and type validation prevent abuse and malicious uploads
 * Memory storage eliminates temporary file cleanup concerns in serverless environments
 */
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory for serverless compatibility
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Single file upload for this endpoint
  },
  fileFilter: (req, file, callback) => {
    // MIME type validation with additional extension check
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedExtensions = /\.(jpg|jpeg|png|webp)$/i;
    
    if (allowedMimes.includes(file.mimetype) && allowedExtensions.test(file.originalname)) {
      callback(null, true);
    } else {
      callback(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  },
});

// Promisify multer for async/await usage
const uploadMiddleware = promisify(upload.single('photo'));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED' 
    });
  }

  try {
    // Authentication check with early return pattern
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      });
    }

    // File upload processing with error handling
    try {
      await uploadMiddleware(req as any, res as any);
    } catch (multerError) {
      return res.status(400).json({ 
        error: (multerError as Error).message,
        code: 'UPLOAD_ERROR' 
      });
    }

    // Type assertion with null check - TypeScript safety
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        code: 'NO_FILE' 
      });
    }

    // Cloudinary upload with comprehensive error handling
    const uploadResult = await uploadToCloudinary(file.buffer, file.originalname);
    if (!uploadResult.success) {
      return res.status(500).json({ 
        error: uploadResult.error,
        code: 'CLOUDINARY_ERROR' 
      });
    }

    // Database storage with transaction-like error handling
    const db = getDatabase();
    const photoId = db.addPhoto({
      cloudinary_id: uploadResult.data!.cloudinary_id,
      public_url: uploadResult.data!.public_url,
      title: req.body.title || file.originalname,
      description: req.body.description || null,
      upload_date: new Date().toISOString(),
    });

    if (!photoId) {
      // Cleanup Cloudinary upload if database insertion fails
      await deleteFromCloudinary(uploadResult.data!.cloudinary_id);
      return res.status(500).json({ 
        error: 'Failed to save photo metadata',
        code: 'DATABASE_ERROR' 
      });
    }

    return res.status(201).json({
      id: photoId,
      cloudinary_id: uploadResult.data!.cloudinary_id,
      public_url: uploadResult.data!.public_url,
      message: 'Photo uploaded successfully',
    });

  } catch (error) {
    console.error('Photo upload error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR' 
    });
  }
}

// Disable Next.js body parser for file uploads
export const config = {
  api: {
    bodyParser: false, // Required for multer to handle multipart/form-data
  },
};

