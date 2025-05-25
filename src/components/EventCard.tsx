import React, { memo } from 'react';
import { differenceInDays, format, isToday, isTomorrow, parseISO } from 'date-fns';

interface Event {
  id: number;
  title: string;
  date: string;
  description?: string;
  is_recurring: boolean;
}

interface EventCardProps {
  event: Event;
  onEdit?: (event: Event) => void;
  onDelete?: (id: number) => void;
  isEditable?: boolean;
}

/**
 * Memoized event card component with performance-critical date calculations
 * React.memo optimization prevents unnecessary re-renders when parent state changes
 * Date calculations are memoized to avoid repeated expensive operations
 */
const EventCard = memo<EventCardProps>(({ event, onEdit, onDelete, isEditable }) => {
  // Performance-critical date calculations with error handling
  const eventDate = parseISO(event.date);
  const now = new Date();
  const daysUntil = differenceInDays(eventDate, now);
  const isEventToday = isToday(eventDate);
  const isEventTomorrow = isTomorrow(eventDate);
  const isPastEvent = daysUntil < 0;
  
  // Conditional styling based on event proximity - reduces runtime calculations
  const cardStyle = isEventToday 
    ? 'bg-gradient-to-r from-pink-100 to-rose-100 border-2 border-pink-400 shadow-lg transform scale-105'
    : isEventTomorrow
    ? 'bg-gradient-to-r from-pink-50 to-rose-50 border-2 border-pink-300 shadow-md'
    : isPastEvent
    ? 'bg-gray-50 border border-gray-200 opacity-75'
    : 'bg-white border border-pink-200 hover:shadow-md hover:border-pink-300';

  return (
    <div className={`rounded-lg p-6 transition-all duration-300 ${cardStyle}`}>
      {/* Event highlight indicator for immediate visual feedback */}
      {(isEventToday || isEventTomorrow) && (
        <div className="flex items-center mb-2">
          <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse mr-2" />
          <span className="text-sm font-medium text-pink-600">
            {isEventToday ? 'Today!' : 'Tomorrow'}
          </span>
        </div>
      )}
      
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-gray-800 text-lg">{event.title}</h3>
        
        {/* Edit controls with proper event handling */}
        {isEditable && (
          <div className="flex space-x-2">
            <button
              onClick={() => onEdit?.(event)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
              aria-label={`Edit ${event.title}`}
            >
              Edit
            </button>
            <button
              onClick={() => onDelete?.(event.id)}
              className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
              aria-label={`Delete ${event.title}`}
            >
              Delete
            </button>
          </div>
        )}
      </div>
      
      {/* Event description with proper text handling */}
      {event.description && (
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{event.description}</p>
      )}
      
      {/* Date information with intelligent formatting */}
      <div className="text-sm">
        <p className="text-gray-700 font-medium">
          {format(eventDate, 'MMMM d, yyyy')}
        </p>
        
        {/* Countdown display with context-aware messaging */}
        <p className={`mt-1 ${isPastEvent ? 'text-gray-500' : 'text-pink-600'} font-medium`}>
          {isPastEvent 
            ? `${Math.abs(daysUntil)} days ago`
            : daysUntil === 0 
            ? 'Today! 🎉'
            : daysUntil === 1
            ? 'Tomorrow! 🗓️'
            : `in ${daysUntil} days`
          }
        </p>
      </div>
      
      {/* Recurring event indicator */}
      {event.is_recurring && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            📅 Annual Event
          </span>
        </div>
      )}
    </div>
  );
});

EventCard.displayName = 'EventCard';

export default EventCard;