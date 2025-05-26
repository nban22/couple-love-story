
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from '../../../lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED' 
    });
  }

  try {
    const db = await getDatabase();
    const photos = await db.getAllPhotos();
    
    // Performance optimization: Transform URLs for responsive images
    const optimizedPhotos = photos.map(photo => ({
      ...photo,
      // Generate responsive image URLs for different screen sizes
      thumbnails: {
        small: photo.public_url.replace('/upload/', '/upload/w_300,h_200,c_fill,q_auto:low/'),
        medium: photo.public_url.replace('/upload/', '/upload/w_600,h_400,c_fill,q_auto:good/'),
        large: photo.public_url.replace('/upload/', '/upload/w_1200,h_800,c_limit,q_auto:good/'),
      },
    }));

    return res.status(200).json(optimizedPhotos);
  } catch (error) {
    console.error('Photo gallery error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR' 
    });
  }
}