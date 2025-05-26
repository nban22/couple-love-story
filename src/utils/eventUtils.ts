// utils/eventUtils.ts - Comprehensive event calculation and validation utilities
import { 
  addDays, addWeeks, addMonths, addYears, 
  isBefore, isAfter, parseISO, formatISO,
  differenceInDays, startOfDay, endOfDay,
  isValid, format, isSameDay, isToday, isTomorrow,
  setDay, getDayOfYear, getDaysInMonth
} from 'date-fns';
import { format as formatTz } from 'date-fns-tz';
import type { 
  EnhancedEvent, 
  RecurringEventConfig, 
  EventOccurrence, 
  EventFormData, 
  EventValidationError 
} from '../types/event';

/**
 * Event Validation System
 * Comprehensive validation for event data with detailed error reporting
 */
export class EventValidator {
  private static readonly MAX_TITLE_LENGTH = 100;
  private static readonly MAX_DESCRIPTION_LENGTH = 1000;
  private static readonly MAX_LOCATION_LENGTH = 200;
  private static readonly MIN_DATE = new Date('1900-01-01');
  private static readonly MAX_DATE = new Date('2100-12-31');

  /**
   * Validates complete event form data
   * Returns array of validation errors, empty if valid
   */
  static validateEventData(data: EventFormData): EventValidationError[] {
    const errors: EventValidationError[] = [];

    // Title validation
    if (!data.title || data.title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Event title is required' });
    } else if (data.title.length > this.MAX_TITLE_LENGTH) {
      errors.push({ 
        field: 'title', 
        message: `Title cannot exceed ${this.MAX_TITLE_LENGTH} characters` 
      });
    } else if (this.containsHtmlTags(data.title)) {
      errors.push({ field: 'title', message: 'Title cannot contain HTML tags' });
    }

    // Date validation
    const dateValidation = this.validateDate(data.date, data.timezone);
    if (dateValidation) {
      errors.push(dateValidation);
    }

    // Description validation
    if (data.description && data.description.length > this.MAX_DESCRIPTION_LENGTH) {
      errors.push({ 
        field: 'description', 
        message: `Description cannot exceed ${this.MAX_DESCRIPTION_LENGTH} characters` 
      });
    }

    // Location validation
    if (data.location && data.location.length > this.MAX_LOCATION_LENGTH) {
      errors.push({ 
        field: 'location', 
        message: `Location cannot exceed ${this.MAX_LOCATION_LENGTH} characters` 
      });
    }

    // Recurring event validation
    if (data.is_recurring && data.recurring_config) {
      const recurringErrors = this.validateRecurringConfig(data.recurring_config);
      errors.push(...recurringErrors);
    }

    // Reminder validation
    if (data.reminder_minutes !== undefined) {
      if (data.reminder_minutes < 0 || data.reminder_minutes > 10080) { // Max 1 week
        errors.push({ 
          field: 'reminder_minutes', 
          message: 'Reminder must be between 0 and 10080 minutes (1 week)' 
        });
      }
    }

    return errors;
  }

  private static validateDate(dateString: string, timezone: string): EventValidationError | null {
    if (!dateString) {
      return { field: 'date', message: 'Event date is required' };
    }

    const date = parseISO(dateString);
    if (!isValid(date)) {
      return { field: 'date', message: 'Invalid date format' };
    }

    if (isBefore(date, this.MIN_DATE) || isAfter(date, this.MAX_DATE)) {
      return { 
        field: 'date', 
        message: `Date must be between ${format(this.MIN_DATE, 'yyyy')} and ${format(this.MAX_DATE, 'yyyy')}` 
      };
    }

    // Validate timezone
    try {
      formatTz(date, 'yyyy-MM-dd', { timeZone: timezone });
    } catch (error) {
      return { field: 'timezone', message: 'Invalid timezone' };
    }

    return null;
  }

  private static validateRecurringConfig(config: RecurringEventConfig): EventValidationError[] {
    const errors: EventValidationError[] = [];

    if (config.interval < 1 || config.interval > 365) {
      errors.push({ 
        field: 'recurring_config', 
        message: 'Recurring interval must be between 1 and 365' 
      });
    }

    if (config.end_date) {
      const endDate = parseISO(config.end_date);
      if (!isValid(endDate)) {
        errors.push({ 
          field: 'recurring_config', 
          message: 'Invalid end date for recurring event' 
        });
      }
    }

    if (config.max_occurrences && (config.max_occurrences < 1 || config.max_occurrences > 1000)) {
      errors.push({ 
        field: 'recurring_config', 
        message: 'Max occurrences must be between 1 and 1000' 
      });
    }

    return errors;
  }

  private static containsHtmlTags(text: string): boolean {
    const htmlTagPattern = /<[^>]*>/g;
    return htmlTagPattern.test(text);
  }
}

/**
 * Recurring Event Calculator
 * Handles complex recurring event logic with timezone support
 */
export class RecurringEventCalculator {
  /**
   * Calculates all occurrences of a recurring event within a date range
   * Optimized for performance with early termination conditions
   */
  static calculateOccurrences(
    event: EnhancedEvent,
    startDate: Date,
    endDate: Date,
    maxOccurrences: number = 100
  ): EventOccurrence[] {
    if (!event.is_recurring || !event.recurring_config) {
      // Return single occurrence for non-recurring events
      const eventDate = parseISO(event.date);
      if (eventDate >= startDate && eventDate <= endDate) {
        return [{
          id: `${event.id}-original`,
          event_id: event.id,
          date: event.date,
          is_original: true,
          occurrence_index: 0
        }];
      }
      return [];
    }

    const occurrences: EventOccurrence[] = [];
    const config = event.recurring_config;
    let currentDate = parseISO(event.date);
    let occurrenceIndex = 0;

    // Handle timezone conversion
    const timezone = event.timezone || 'UTC';
    
    while (occurrences.length < maxOccurrences) {
      // Check if current date is within range
      if (currentDate >= startDate && currentDate <= endDate) {
        occurrences.push({
          id: `${event.id}-${occurrenceIndex}`,
          event_id: event.id,
          date: formatISO(currentDate),
          is_original: occurrenceIndex === 0,
          occurrence_index: occurrenceIndex
        });
      }

      // Check termination conditions
      if (config.end_date && isAfter(currentDate, parseISO(config.end_date))) {
        break;
      }

      if (config.max_occurrences && occurrenceIndex >= config.max_occurrences - 1) {
        break;
      }

      if (isAfter(currentDate, endDate)) {
        break;
      }

      // Calculate next occurrence
      currentDate = this.getNextOccurrenceDate(currentDate, config);
      occurrenceIndex++;

      // Safety valve to prevent infinite loops
      if (occurrenceIndex > 10000) {
        console.warn('RecurringEventCalculator: Hit safety limit, terminating calculation');
        break;
      }
    }

    return occurrences;
  }

  /**
   * Calculates the next occurrence date based on recurring configuration
   */
  private static getNextOccurrenceDate(currentDate: Date, config: RecurringEventConfig): Date {
    switch (config.frequency) {
      case 'daily':
        return addDays(currentDate, config.interval);
        
      case 'weekly':
        if (config.days_of_week && config.days_of_week.length > 0) {
          return this.getNextWeeklyOccurrence(currentDate, config);
        }
        return addWeeks(currentDate, config.interval);
        
      case 'monthly':
        if (config.day_of_month) {
          return this.getNextMonthlyOccurrence(currentDate, config);
        }
        return addMonths(currentDate, config.interval);
        
      case 'yearly':
        return addYears(currentDate, config.interval);
        
      default:
        throw new Error(`Unsupported recurring frequency: ${config.frequency}`);
    }
  }

  /**
   * Handles complex weekly recurring patterns with specific days
   */
  private static getNextWeeklyOccurrence(currentDate: Date, config: RecurringEventConfig): Date {
    const daysOfWeek = config.days_of_week!.sort();
    const currentDayOfWeek = currentDate.getDay();
    
    // Find next day in current week
    const nextDayInWeek = daysOfWeek.find(day => day > currentDayOfWeek);
    
    if (nextDayInWeek !== undefined) {
      // Next occurrence is in current week
      return setDay(currentDate, nextDayInWeek);
    } else {
      // Move to next interval and use first day
      const nextWeek = addWeeks(currentDate, config.interval);
      return setDay(nextWeek, daysOfWeek[0]);
    }
  }

  /**
   * Handles monthly recurring events with specific day of month
   */
  private static getNextMonthlyOccurrence(currentDate: Date, config: RecurringEventConfig): Date {
    const targetDay = config.day_of_month!;
    let nextMonth = addMonths(currentDate, config.interval);
    
    // Handle months with fewer days than target day
    const daysInMonth = getDaysInMonth(nextMonth);
    if (targetDay > daysInMonth) {
      // Use last day of month if target day doesn't exist
      nextMonth.setDate(daysInMonth);
    } else {
      nextMonth.setDate(targetDay);
    }
    
    return nextMonth;
  }

  /**
   * Gets the next single occurrence of a recurring event after given date
   */
  
  static getNextOccurrence(event: EnhancedEvent, afterDate: Date = new Date()): Date | null {
    if (!event.is_recurring || !event.recurring_config) {
      const eventDate = parseISO(event.date);
      return isAfter(eventDate, afterDate) ? eventDate : null;
    }

    const occurrences = this.calculateOccurrences(
      event,
      afterDate,
      addYears(afterDate, 2), // Look ahead 2 years max
      10 // Only need first few occurrences
    );

    const nextOccurrence = occurrences.find(occ => isAfter(parseISO(occ.date), afterDate));
    return nextOccurrence ? parseISO(nextOccurrence.date) : null;
  }
}

/**
 * Event Display Utilities
 * Formatting and display logic for events
 */
export class EventDisplayUtils {
  /**
   * Formats event date with timezone awareness and relative display
   */
  static formatEventDate(
    event: EnhancedEvent, 
    options: {
      showTime?: boolean;
      showRelative?: boolean;
      userTimezone?: string;
    } = {}
  ): string {
    const { showTime = true, showRelative = true, userTimezone } = options;
    const eventDate = parseISO(event.date);
    const timezone = userTimezone || event.timezone || 'UTC';

    let formattedDate: string;

    if (event.is_all_day) {
      formattedDate = format(eventDate, 'MMMM d, yyyy');
    } else if (showTime) {
      formattedDate = formatTz(eventDate, 'MMMM d, yyyy \'at\' h:mm a', { timeZone: timezone });
    } else {
      formattedDate = format(eventDate, 'MMMM d, yyyy');
    }

    if (showRelative) {
      const relativeText = this.getRelativeDateText(eventDate);
      if (relativeText) {
        return `${formattedDate} (${relativeText})`;
      }
    }

    return formattedDate;
  }

  /**
   * Gets relative date text (Today, Tomorrow, etc.)
   */
  static getRelativeDateText(date: Date): string | null {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    
    const daysDiff = differenceInDays(date, new Date());
    if (daysDiff > 0 && daysDiff <= 7) {
      return `in ${daysDiff} day${daysDiff > 1 ? 's' : ''}`;
    }
    if (daysDiff < 0 && daysDiff >= -7) {
      return `${Math.abs(daysDiff)} day${Math.abs(daysDiff) > 1 ? 's' : ''} ago`;
    }
    
    return null;
  }

  /**
   * Gets priority display information
   */
  static getPriorityDisplay(priority: EnhancedEvent['priority']): {
    label: string;
    color: string;
    icon: string;
  } {
    switch (priority) {
      case 'high':
        return { label: 'High Priority', color: 'text-red-600 bg-red-100', icon: '🔴' };
      case 'medium':
        return { label: 'Medium Priority', color: 'text-yellow-600 bg-yellow-100', icon: '🟡' };
      case 'low':
        return { label: 'Low Priority', color: 'text-green-600 bg-green-100', icon: '🟢' };
      default:
        return { label: 'Normal', color: 'text-gray-600 bg-gray-100', icon: '⚪' };
    }
  }

  /**
   * Gets category display information
   */
  static getCategoryDisplay(category: EnhancedEvent['category']): {
    label: string;
    color: string;
    icon: string;
  } {
    switch (category) {
      case 'anniversary':
        return { label: 'Anniversary', color: 'text-pink-600 bg-pink-100', icon: '💕' };
      case 'birthday':
        return { label: 'Birthday', color: 'text-purple-600 bg-purple-100', icon: '🎂' };
      case 'date':
        return { label: 'Date Night', color: 'text-rose-600 bg-rose-100', icon: '🌹' };
      case 'milestone':
        return { label: 'Milestone', color: 'text-blue-600 bg-blue-100', icon: '🏆' };
      case 'other':
        return { label: 'Other', color: 'text-gray-600 bg-gray-100', icon: '📅' };
      default:
        return { label: 'Event', color: 'text-gray-600 bg-gray-100', icon: '📅' };
    }
  }
}

/**
 * Event Sorting and Filtering Utilities
 */
export class EventFilterUtils {
  /**
   * Filters events based on provided criteria
   */
  static filterEvents(events: EnhancedEvent[], filters: Partial<{
    category: EnhancedEvent['category'];
    priority: EnhancedEvent['priority'];
    dateFrom: string;
    dateTo: string;
    searchTerm: string;
    showPast: boolean;
    showRecurring: boolean;
  }>): EnhancedEvent[] {
    return events.filter(event => {
      // Category filter
      if (filters.category && event.category !== filters.category) {
        return false;
      }

      // Priority filter
      if (filters.priority && event.priority !== filters.priority) {
        return false;
      }

      // Date range filter
      const eventDate = parseISO(event.date);
      if (filters.dateFrom && isBefore(eventDate, parseISO(filters.dateFrom))) {
        return false;
      }
      if (filters.dateTo && isAfter(eventDate, parseISO(filters.dateTo))) {
        return false;
      }

      // Past events filter
      if (!filters.showPast && isBefore(eventDate, startOfDay(new Date()))) {
        return false;
      }

      // Recurring events filter
      if (filters.showRecurring === false && event.is_recurring) {
        return false;
      }

      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const searchableText = [
          event.title,
          event.description,
          event.location
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sorts events based on specified criteria
   */
  static sortEvents(
    events: EnhancedEvent[], 
    sortBy: 'date' | 'title' | 'priority' | 'category' = 'date',
    direction: 'asc' | 'desc' = 'asc'
  ): EnhancedEvent[] {
    const sorted = [...events].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = parseISO(a.date).getTime() - parseISO(b.date).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        default:
          comparison = 0;
      }

      return direction === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }
}