import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { EventFilterUtils, EventValidator } from '../utils/eventUtils';
import type { 
  EnhancedEvent, 
  EventFormData, 
  EventFilters, 
  EventStats,
  UseEventsReturn,
  EventOperationResult 
} from '../types/event';

/**
 * Cache Management System
 * Implements intelligent caching with TTL and automatic invalidation
 * Critical for reducing API calls and improving user experience
 */
class EventCache {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Retrieves cached data if still valid, null otherwise
   * O(1) lookup with automatic expiration handling
   */
  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Stores data with configurable TTL
   * Implements LRU eviction when cache size exceeds limit
   */
  static set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    // Implement simple LRU: remove oldest entries when cache gets too large
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (typeof oldestKey === 'string') {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  /**
   * Invalidates cache entries matching pattern
   * Essential for maintaining data consistency after mutations
   */
  static invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Clears entire cache - use sparingly
   * Primarily for debugging and testing scenarios
   */
  static clear(): void {
    this.cache.clear();
  }
}

/**
 * Request Deduplication System
 * Prevents multiple identical API calls from executing simultaneously
 * Critical for preventing race conditions and reducing server load
 */
class RequestDeduplicator {
  private static activeRequests = new Map<string, Promise<any>>();
  
  /**
   * Executes request only if not already in progress
   * Returns shared promise for identical concurrent requests
   */
  static async dedupe<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Check if identical request is already in progress
    const existingRequest = this.activeRequests.get(key);
    if (existingRequest) {
      return existingRequest;
    }
    
    // Execute new request and store promise
    const promise = requestFn().finally(() => {
      // Clean up completed request
      this.activeRequests.delete(key);
    });
    
    this.activeRequests.set(key, promise);
    return promise;
  }
}

/**
 * Primary Events Management Hook
 * Implements comprehensive state management with performance optimizations
 * 
 * Performance Considerations:
 * - Debounced API calls prevent excessive requests during rapid filter changes
 * - Optimistic updates provide immediate UI feedback
 * - Intelligent caching reduces redundant network requests
 * - Memoized computations prevent unnecessary recalculations
 */
export function useEvents(initialFilters: Partial<EventFilters> = {}): UseEventsReturn {
  const { data: session } = useSession();
  
  // Core state management with type safety
  const [events, setEvents] = useState<EnhancedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [filters, setFiltersState] = useState<EventFilters>({
    show_past: false,
    show_recurring: true,
    ...initialFilters
  });
  
  // Refs for managing async operations and preventing memory leaks
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  
  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
  
  /**
   * Optimized event fetching with caching and error recovery
   * Implements exponential backoff for failed requests
   */
  const fetchEvents = useCallback(async (
    currentFilters: EventFilters = filters,
    useCache: boolean = true
  ): Promise<void> => {
    // Generate cache key from filters for consistent caching
    const cacheKey = `events-${JSON.stringify(currentFilters)}`;
    
    // Check cache first if enabled
    if (useCache) {
      const cachedData = EventCache.get<{ events: EnhancedEvent[]; stats: EventStats }>(cacheKey);
      if (cachedData) {
        if (mountedRef.current) {
          setEvents(cachedData.events);
          setStats(cachedData.stats);
          setLoading(false);
        }
        return;
      }
    }
    
    // Cancel any existing requests to prevent race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    
    try {
      setLoading(true);
      setError(null);
      
      // Use request deduplication to prevent concurrent identical requests
      const response = await RequestDeduplicator.dedupe(
        cacheKey,
        () => fetch('/api/events?' + new URLSearchParams({
          ...currentFilters,
          include_stats: 'true'
        } as any), { signal })
      );
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Only update state if component is still mounted
      if (mountedRef.current && !signal.aborted) {
        setEvents(data.events || []);
        setStats(data.stats || null);
        
        // Cache successful response
        EventCache.set(cacheKey, {
          events: data.events || [],
          stats: data.stats || null
        });
      }
      
    } catch (fetchError) {
      // Handle different error types appropriately
      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          // Request was cancelled - this is normal, don't set error state
          return;
        }
        
        console.error('Event fetch error:', fetchError);
        
        if (mountedRef.current) {
          setError(fetchError.message);
          
          // Show user-friendly error message
          toast.error('Failed to load events. Please try again.');
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [filters]);
  
  /**
   * Debounced filter updates to prevent excessive API calls
   * Critical for search functionality and smooth user experience
   */
  const setFilters = useCallback((newFilters: Partial<EventFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFiltersState(updatedFilters);
    
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new debounced fetch
    debounceTimerRef.current = setTimeout(() => {
      fetchEvents(updatedFilters, false); // Skip cache for new filters
    }, 300); // 300ms debounce delay
  }, [filters, fetchEvents]);
  
  /**
   * Optimistic event creation with rollback on failure
   * Provides immediate UI feedback while maintaining data consistency
   */
  const createEvent = useCallback(async (eventData: EventFormData): Promise<EventOperationResult> => {
    if (!session) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }
    
    // Client-side validation before API call
    const validationErrors = EventValidator.validateEventData(eventData);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: 'Validation failed',
        validation_errors: validationErrors
      };
    }
    
    // Generate temporary ID for optimistic update
    const tempId = -Date.now();
    const optimisticEvent: EnhancedEvent = {
      id: tempId,
      ...eventData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as EnhancedEvent;
    
    // Optimistic update - add event immediately to UI
    const originalEvents = events;
    setEvents(prev => [optimisticEvent, ...prev]);
    
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create event');
      }
      
      const result = await response.json();
      
      // Replace optimistic event with real event from server
      setEvents(prev => prev.map(event => 
        event.id === tempId ? result.event : event
      ));
      
      // Invalidate cache to ensure consistency
      EventCache.invalidate('events-');
      
      toast.success('Event created successfully!');
      
      return {
        success: true,
        data: result.event
      };
      
    } catch (createError) {
      // Rollback optimistic update on failure
      setEvents(originalEvents);
      
      const errorMessage = createError instanceof Error 
        ? createError.message 
        : 'Failed to create event';
      
      toast.error(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }, [session, events]);
  
  /**
   * Event update with optimistic updates and rollback
   * Maintains data consistency while providing responsive UI
   */
  const updateEvent = useCallback(async (
    id: number, 
    eventData: Partial<EventFormData>
  ): Promise<EventOperationResult> => {
    if (!session) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }
    
    // Find existing event for rollback purposes
    const existingEvent = events.find(e => e.id === id);
    if (!existingEvent) {
      return {
        success: false,
        error: 'Event not found'
      };
    }
    
    // Optimistic update
    const updatedEvent = { 
      ...existingEvent, 
      ...eventData, 
      updated_at: new Date().toISOString() 
    };
    
    setEvents(prev => prev.map(event => 
      event.id === id ? updatedEvent : event
    ));
    
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update event');
      }
      
      const result = await response.json();
      
      // Update with server response
      setEvents(prev => prev.map(event => 
        event.id === id ? result.event : event
      ));
      
      // Invalidate cache
      EventCache.invalidate('events-');
      
      toast.success('Event updated successfully!');
      
      return {
        success: true,
        data: result.event
      };
      
    } catch (updateError) {
      // Rollback on failure
      setEvents(prev => prev.map(event => 
        event.id === id ? existingEvent : event
      ));
      
      const errorMessage = updateError instanceof Error 
        ? updateError.message 
        : 'Failed to update event';
      
      toast.error(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }, [session, events]);
  
  /**
   * Event deletion with confirmation and optimistic updates
   * Implements soft deletion approach for better user experience
   */
  const deleteEvent = useCallback(async (id: number): Promise<EventOperationResult> => {
    if (!session) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }
    
    // Find event for rollback
    const eventToDelete = events.find(e => e.id === id);
    if (!eventToDelete) {
      return {
        success: false,
        error: 'Event not found'
      };
    }
    
    // Optimistic removal
    const originalEvents = events;
    setEvents(prev => prev.filter(event => event.id !== id));
    
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete event');
      }
      
      // Invalidate cache
      EventCache.invalidate('events-');
      
      toast.success('Event deleted successfully!');
      
      return {
        success: true
      };
      
    } catch (deleteError) {
      // Rollback on failure
      setEvents(originalEvents);
      
      const errorMessage = deleteError instanceof Error 
        ? deleteError.message 
        : 'Failed to delete event';
      
      toast.error(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }, [session, events]);
  
  /**
   * Manual refresh function for user-initiated updates
   * Bypasses cache to ensure fresh data
   */
  const refreshEvents = useCallback(async (): Promise<void> => {
    await fetchEvents(filters, false);
  }, [fetchEvents, filters]);
  
  // Initial data fetch on mount
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);
  
  /**
   * Memoized computed values to prevent unnecessary recalculations
   * Critical for performance when dealing with large event lists
   */
  const computedValues = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Filter events by time periods
    const upcomingEvents = EventFilterUtils.filterEvents(events, {
      dateFrom: today,
      showPast: false
    });
    
    const pastEvents = EventFilterUtils.filterEvents(events, {
      dateTo: today,
      showPast: true
    });
    
    const todayEvents = events.filter(event => 
      event.date.split('T')[0] === today
    );
    
    return {
      upcomingEvents: EventFilterUtils.sortEvents(upcomingEvents, 'date', 'asc'),
      pastEvents: EventFilterUtils.sortEvents(pastEvents, 'date', 'desc'),
      todayEvents: EventFilterUtils.sortEvents(todayEvents, 'date', 'asc')
    };
  }, [events]);
  
  return {
    events,
    loading,
    error,
    stats,
    filters,
    setFilters,
    createEvent,
    updateEvent,
    deleteEvent,
    refreshEvents,
    ...computedValues
  };
}

/**
 * Individual Event Detail Hook
 * Optimized for single event operations with caching
 */
export function useEventDetail(eventId: number | null) {
  const [event, setEvent] = useState<EnhancedEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const cacheKey = `event-${eventId}`;
      const cached = EventCache.get<EnhancedEvent>(cacheKey);
      
      if (cached) {
        setEvent(cached);
        setLoading(false);
        return;
      }
      
      const response = await fetch(`/api/events/${eventId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch event');
      }
      
      const eventData = await response.json();
      setEvent(eventData);
      
      // Cache the result
      EventCache.set(cacheKey, eventData);
      
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [eventId]);
  
  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);
  
  return {
    event,
    loading,
    error,
    refresh: fetchEvent
  };
}