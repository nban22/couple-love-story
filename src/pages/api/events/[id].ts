import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { getDatabase } from '../../../lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Parameter extraction with type safety
  const { id } = req.query;
  const eventId = parseInt(id as string);
  
  if (isNaN(eventId)) {
    return res.status(400).json({ 
      error: 'Invalid event ID',
      code: 'INVALID_PARAMETER' 
    });
  }

  try {
    const db = getDatabase();

    switch (req.method) {
      case 'PUT':
        const session = await getServerSession(req, res, authOptions);
        if (!session) {
          return res.status(401).json({ 
            error: 'Authentication required',
            code: 'UNAUTHORIZED' 
          });
        }

        const updateData = req.body;
        const updateSuccess = db.updateEvent(eventId, updateData);
        
        if (!updateSuccess) {
          return res.status(404).json({ 
            error: 'Event not found or update failed',
            code: 'UPDATE_FAILED' 
          });
        }

        return res.status(200).json({ 
          message: 'Event updated successfully' 
        });

      case 'DELETE':
        const deleteSession = await getServerSession(req, res, authOptions);
        if (!deleteSession) {
          return res.status(401).json({ 
            error: 'Authentication required',
            code: 'UNAUTHORIZED' 
          });
        }

        const deleteSuccess = db.deleteEvent(eventId);
        
        if (!deleteSuccess) {
          return res.status(404).json({ 
            error: 'Event not found',
            code: 'DELETE_FAILED' 
          });
        }

        return res.status(200).json({ 
          message: 'Event deleted successfully' 
        });

      default:
        res.setHeader('Allow', ['PUT', 'DELETE']);
        return res.status(405).json({ 
          error: `Method ${req.method} not allowed`,
          code: 'METHOD_NOT_ALLOWED' 
        });
    }
  } catch (error) {
    console.error(`API Error in /api/events/${eventId}:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR' 
    });
  }
}