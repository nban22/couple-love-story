import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { getDatabase } from '../../../lib/database';
import { isValid, parseISO } from 'date-fns';

interface EventRequest {
  title: string;
  date: string;
  description?: string;
  is_recurring?: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const db = getDatabase();

    switch (req.method) {
      case 'GET':
        // Query parameter parsing for flexible event retrieval
        const { upcoming, limit } = req.query;
        
        let events;
        if (upcoming === 'true') {
          const limitNum = parseInt(limit as string) || 5;
          events = db.getUpcomingEvents(limitNum);
        } else {
          events = db.getAllEvents();
        }
        
        return res.status(200).json(events);

      case 'POST':
        // Authentication check with early return pattern
        const session = await getServerSession(req, res, authOptions);
        if (!session) {
          return res.status(401).json({ 
            error: 'Authentication required',
            code: 'UNAUTHORIZED' 
          });
        }

        // Comprehensive input validation
        const eventData: EventRequest = req.body;
        
        if (!eventData.title || eventData.title.trim().length === 0) {
          return res.status(400).json({ 
            error: 'Event title is required',
            code: 'VALIDATION_ERROR' 
          });
        }
        
        if (!eventData.date || !isValid(parseISO(eventData.date))) {
          return res.status(400).json({ 
            error: 'Valid date is required (ISO format)',
            code: 'VALIDATION_ERROR' 
          });
        }

        // Sanitize and prepare data for database insertion
        const sanitizedEvent = {
          title: eventData.title.trim(),
          date: eventData.date,
          description: eventData.description?.trim() || undefined,
          is_recurring: Boolean(eventData.is_recurring),
        };

        const eventId = db.addEvent(sanitizedEvent);
        if (!eventId) {
          return res.status(500).json({ 
            error: 'Failed to create event',
            code: 'CREATE_FAILED' 
          });
        }

        return res.status(201).json({ 
          id: eventId,
          message: 'Event created successfully' 
        });

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ 
          error: `Method ${req.method} not allowed`,
          code: 'METHOD_NOT_ALLOWED' 
        });
    }
  } catch (error) {
    console.error('API Error in /api/events:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR' 
    });
  }
}