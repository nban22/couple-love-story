// components/EventCard.tsx - Enhanced event card with comprehensive UX improvements
import React, { memo, useMemo, useState, useCallback } from 'react';
import { parseISO, isToday, isTomorrow, isPast, formatDistanceToNow } from 'date-fns';
import { 
  EventDisplayUtils, 
  RecurringEventCalculator 
} from '../utils/eventUtils';
import type { EnhancedEvent } from '../types/event';

interface EventCardProps {
  event: EnhancedEvent;
  onEdit?: (event: EnhancedEvent) => void;
  onDelete?: (id: number) => void;
  onDuplicate?: (event: EnhancedEvent) => void;
  isEditable?: boolean;
  showDetails?: boolean;
  size?: 'compact' | 'normal' | 'expanded';
  userTimezone?: string;
}

/**
 * Enhanced EventCard Component
 * 
 * Performance Optimizations:
 * - React.memo prevents unnecessary re-renders when parent state changes
 * - useMemo for expensive date calculations and styling computations
 * - useCallback for event handlers to prevent child re-renders
 * 
 * UX Improvements:
 * - Visual priority indicators with color coding
 * - Category badges with contextual icons
 * - Smart date formatting with relative time display
 * - Recurring event indicators with next occurrence info
 * - Loading states and error boundaries
 * - Accessible keyboard navigation and ARIA labels
 */
const EventCard = memo<EventCardProps>(({
  event,
  onEdit,
  onDelete,
  onDuplicate,
  isEditable = false,
  showDetails = true,
  size = 'normal',
  userTimezone
}) => {
  // State management for card interactions
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showActions, setShowActions] = useState(false);

  /**
   * Memoized date calculations - prevents expensive recalculations on every render
   * Critical for performance when rendering large event lists
   */
  const dateInfo = useMemo(() => {
    const eventDate = parseISO(event.date);
    
    return {
      eventDate,
      isEventToday: isToday(eventDate),
      isEventTomorrow: isTomorrow(eventDate),
      isPastEvent: isPast(eventDate),
      relativeTime: formatDistanceToNow(eventDate, { addSuffix: true }),
      formattedDate: EventDisplayUtils.formatEventDate(event, {
        showTime: !event.is_all_day,
        showRelative: false,
        userTimezone
      })
    };
  }, [event, userTimezone]);

  /**
   * Memoized recurring event information
   * Calculates next occurrence for recurring events efficiently
   */
  const recurringInfo = useMemo(() => {
    if (!event.is_recurring || !event.recurring_config) {
      return null;
    }

    const nextOccurrence = RecurringEventCalculator.getNextOccurrence(event);
    return {
      nextOccurrence,
      nextOccurrenceText: nextOccurrence 
        ? EventDisplayUtils.formatEventDate(
            { ...event, date: nextOccurrence.toISOString() },
            { showTime: !event.is_all_day, userTimezone }
          )
        : 'No future occurrences'
    };
  }, [event, userTimezone]);

  /**
   * Memoized styling calculations - prevents repeated class computations
   * Priority-based color schemes with accessibility considerations
   */
  const cardStyles = useMemo(() => {
    const priorityDisplay = EventDisplayUtils.getPriorityDisplay(event.priority);
    const categoryDisplay = EventDisplayUtils.getCategoryDisplay(event.category);
    
    // Base styling with conditional modifiers
    let baseClasses = 'rounded-xl p-6 transition-all duration-300 transform hover:scale-102 hover:shadow-lg';
    let borderClasses = 'border-2';
    let backgroundClasses = 'bg-white';

    // Priority-based styling with semantic color coding
    if (dateInfo.isEventToday) {
      borderClasses += ' border-pink-400 shadow-lg scale-105';
      backgroundClasses = 'bg-gradient-to-r from-pink-100 to-rose-100';
    } else if (dateInfo.isEventTomorrow) {
      borderClasses += ' border-pink-300 shadow-md';
      backgroundClasses = 'bg-gradient-to-r from-pink-50 to-rose-50';
    } else if (dateInfo.isPastEvent) {
      borderClasses += ' border-gray-200';
      backgroundClasses = 'bg-gray-50 opacity-75';
    } else {
      // Future events - priority-based coloring
      switch (event.priority) {
        case 'high':
          borderClasses += ' border-red-200 hover:border-red-300';
          break;
        case 'medium':
          borderClasses += ' border-yellow-200 hover:border-yellow-300';
          break;
        default:
          borderClasses += ' border-gray-200 hover:border-pink-300';
      }
    }

    // Size-based modifications
    if (size === 'compact') {
      baseClasses = baseClasses.replace('p-6', 'p-4');
    } else if (size === 'expanded') {
      baseClasses += ' min-h-48';
    }

    return {
      cardClasses: `${baseClasses} ${borderClasses} ${backgroundClasses}`,
      priorityDisplay,
      categoryDisplay
    };
  }, [event.priority, event.category, dateInfo, size]);

  // Event handlers with useCallback optimization
  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(event);
  }, [onEdit, event]);

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete?.(event.id);
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setIsDeleting(false);
    }
  }, [onDelete, event.id]);

  const handleDuplicate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate?.(event);
  }, [onDuplicate, event]);

  const toggleExpanded = useCallback(() => {
    if (showDetails) {
      setIsExpanded(prev => !prev);
    }
  }, [showDetails]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        toggleExpanded();
        break;
      case 'e':
        if (e.ctrlKey && isEditable) {
          e.preventDefault();
          onEdit?.(event);
        }
        break;
      case 'Delete':
        if (isEditable) {
          e.preventDefault();
          handleDelete(e as any);
        }
        break;
    }
  }, [toggleExpanded, isEditable, onEdit, event, handleDelete]);

  return (
    <div
      className={cardStyles.cardClasses}
      onClick={toggleExpanded}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      tabIndex={showDetails ? 0 : -1}
      role="button"
      aria-expanded={isExpanded}
      aria-label={`Event: ${event.title}. ${dateInfo.formattedDate}. Press Enter to expand details.`}
    >
      {/* Priority and status indicators */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {/* Today/Tomorrow indicator */}
          {(dateInfo.isEventToday || dateInfo.isEventTomorrow) && (
            <div className="flex items-center">
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse mr-2" />
              <span className="text-sm font-semibold text-pink-600 uppercase tracking-wide">
                {dateInfo.isEventToday ? 'Today!' : 'Tomorrow'}
              </span>
            </div>
          )}
          
          {/* Priority indicator */}
          {event.priority !== 'low' && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${cardStyles.priorityDisplay.color}`}>
              {cardStyles.priorityDisplay.icon} {cardStyles.priorityDisplay.label}
            </span>
          )}
        </div>

        {/* Action buttons */}
        {isEditable && (showActions || isExpanded) && (
          <div className="flex items-center space-x-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <button
              onClick={handleEdit}
              className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
              aria-label={`Edit ${event.title}`}
              title="Edit event"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            
            {onDuplicate && (
              <button
                onClick={handleDuplicate}
                className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                aria-label={`Duplicate ${event.title}`}
                title="Duplicate event"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              aria-label={`Delete ${event.title}`}
              title="Delete event"
            >
              {isDeleting ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Event title and category */}
      <div className="mb-3">
        <div className="flex items-start justify-between">
          <h3 className="font-bold text-gray-800 text-lg leading-tight pr-2">
            {event.title}
          </h3>
          <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${cardStyles.categoryDisplay.color}`}>
            {cardStyles.categoryDisplay.icon} {cardStyles.categoryDisplay.label}
          </span>
        </div>
      </div>

      {/* Event description - truncated in compact mode */}
      {event.description && (
        <div className="mb-3">
          <p className={`text-gray-600 text-sm leading-relaxed ${
            size === 'compact' || (!isExpanded && showDetails) 
              ? 'line-clamp-2' 
              : ''
          }`}>
            {event.description}
          </p>
        </div>
      )}

      {/* Date and time information */}
      <div className="mb-3">
        <div className="flex items-center text-sm text-gray-700">
          <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="font-medium">{dateInfo.formattedDate}</span>
          {event.is_all_day && (
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              All Day
            </span>
          )}
        </div>
        
        {/* Relative time display */}
        <p className={`mt-1 text-sm font-medium ${
          dateInfo.isPastEvent ? 'text-gray-500' : 'text-pink-600'
        }`}>
          {dateInfo.isPastEvent ? (
            <>🕒 {dateInfo.relativeTime}</>
          ) : dateInfo.isEventToday ? (
            <>🎉 Today!</>
          ) : dateInfo.isEventTomorrow ? (
            <>📅 Tomorrow!</>
          ) : (
            <>⏰ {dateInfo.relativeTime}</>
          )}
        </p>
      </div>

      {/* Location information */}
      {event.location && (isExpanded || size === 'expanded') && (
        <div className="mb-3">
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{event.location}</span>
          </div>
        </div>
      )}

      {/* Recurring event information */}
      {event.is_recurring && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              🔄 {event.recurring_config?.frequency
                ? event.recurring_config.frequency.charAt(0).toUpperCase() + event.recurring_config.frequency.slice(1)
                : ''} Event
            </span>
            
            {(isExpanded || size === 'expanded') && recurringInfo?.nextOccurrence && (
              <div className="text-xs text-gray-600">
                <span className="font-medium">Next:</span> {recurringInfo.nextOccurrenceText}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reminder indicator */}
      {event.reminder_minutes && (isExpanded || size === 'expanded') && (
        <div className="mt-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            🔔 Reminder: {event.reminder_minutes < 60 
              ? `${event.reminder_minutes}m before`
              : `${Math.floor(event.reminder_minutes / 60)}h before`
            }
          </span>
        </div>
      )}

      {/* Expand/collapse indicator */}
      {showDetails && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="flex justify-center">
            <svg 
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
});

// Performance optimization: Set display name for React DevTools
EventCard.displayName = 'EventCard';

export default EventCard;