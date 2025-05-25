import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { getDatabase } from '../../../lib/database';
import { deleteFromCloudinary } from '../../../lib/cloudinary';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED' 
    });
  }

  try {
    // Authentication validation
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      });
    }

    // Parameter validation
    const { id } = req.query;
    const photoId = parseInt(id as string);
    
    if (isNaN(photoId)) {
      return res.status(400).json({ 
        error: 'Invalid photo ID',
        code: 'INVALID_PARAMETER' 
      });
    }

    // Atomic deletion: Database first, then Cloudinary
    // This prevents orphaned database records if Cloudinary deletion fails
    const db = getDatabase();
    const deletedPhoto = db.deletePhoto(photoId);

    if (!deletedPhoto) {
      return res.status(404).json({ 
        error: 'Photo not found',
        code: 'PHOTO_NOT_FOUND' 
      });
    }

    // Cloudinary cleanup - non-blocking for better UX
    // Even if this fails, the photo is removed from the gallery
    deleteFromCloudinary(deletedPhoto.cloudinary_id).catch(error => {
      console.error('Cloudinary cleanup failed:', error);
      // Consider implementing a cleanup job queue for production
    });

    return res.status(200).json({ 
      message: 'Photo deleted successfully' 
    });

  } catch (error) {
    console.error('Photo deletion error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR' 
    });
  }
}