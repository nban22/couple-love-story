// components/EventManager.tsx - COMPLETELY FIXED enterprise-grade event management
import React, { useState, useCallback, useMemo, useRef, useEffect, useReducer } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import EventCard from './EventCard';
import { useEvents } from '../hooks/useEvents';
import { EventDisplayUtils } from '../utils/eventUtils';
import type {
  EnhancedEvent,
  EventFormData,
  EventFilters,
  RecurringEventConfig
} from '../types/event';

/**
 * COMPLETELY FIXED: Proper Form State Management
 */
interface EventFormState {
  readonly data: EventFormData;
  readonly validation: {
    readonly errors: Record<string, string>;
    readonly isValid: boolean;
    readonly touched: Record<string, boolean>;
    readonly hasBeenValidated: boolean; // NEW: Track if validation has run
  };
  readonly ui: {
    readonly isSubmitting: boolean;
    readonly showAdvanced: boolean;
    readonly showRecurringOptions: boolean;
  };
}

type FormAction =
  | { type: 'SET_FIELD'; field: keyof EventFormData; value: any }
  | { type: 'SET_VALIDATION'; errors: Record<string, string>; isValid: boolean }
  | { type: 'SET_TOUCHED'; field: keyof EventFormData }
  | { type: 'SET_UI_STATE'; updates: Partial<EventFormState['ui']> }
  | { type: 'RESET_FORM'; initialData?: Partial<EventFormData> }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_END' }
  | { type: 'MARK_VALIDATED' }; // NEW: Mark that validation has run

/**
 * FIXED: Default Form Data with proper defaults
 */
const createDefaultFormData = (initialData?: Partial<EventFormData>): EventFormData => ({
  title: initialData?.title || '',
  date: initialData?.date || '',
  description: initialData?.description || '',
  is_recurring: initialData?.is_recurring || false,
  category: initialData?.category || 'other',
  priority: initialData?.priority || 'medium',
  is_all_day: initialData?.is_all_day || false,
  timezone: initialData?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  location: initialData?.location || '',
  reminder_minutes: initialData?.reminder_minutes || undefined,
  recurring_config: initialData?.recurring_config || undefined,
});

/**
 * COMPLETELY FIXED: State Reducer - No premature validation
 */
function eventFormReducer(state: EventFormState, action: FormAction): EventFormState {
  switch (action.type) {
    case 'SET_FIELD':
      const newData = {
        ...state.data,
        [action.field]: action.value
      };

      // Handle recurring config cleanup
      let newUiState = state.ui;
      if (action.field === 'is_recurring' && !action.value) {
        newUiState = {
          ...state.ui,
          showRecurringOptions: false
        };
        newData.recurring_config = undefined;
      } else if (action.field === 'is_recurring' && action.value) {
        newUiState = {
          ...state.ui,
          showRecurringOptions: true
        };
        // Initialize recurring config if not exists
        if (!newData.recurring_config) {
          newData.recurring_config = {
            frequency: 'yearly',
            interval: 1
          };
        }
      }

      return {
        ...state,
        data: newData,
        ui: newUiState,
        validation: {
          ...state.validation,
          touched: {
            ...state.validation.touched,
            [action.field]: true
          }
        }
      };

    case 'SET_VALIDATION':
      return {
        ...state,
        validation: {
          ...state.validation,
          errors: action.errors,
          isValid: action.isValid,
          hasBeenValidated: true
        }
      };

    case 'SET_TOUCHED':
      return {
        ...state,
        validation: {
          ...state.validation,
          touched: {
            ...state.validation.touched,
            [action.field]: true
          }
        }
      };

    case 'SET_UI_STATE':
      return {
        ...state,
        ui: {
          ...state.ui,
          ...action.updates
        }
      };

    case 'RESET_FORM':
      return {
        data: createDefaultFormData(action.initialData),
        validation: {
          errors: {},
          isValid: false,
          touched: {},
          hasBeenValidated: false // RESET validation state
        },
        ui: {
          isSubmitting: false,
          showAdvanced: false,
          showRecurringOptions: action.initialData?.is_recurring || false
        }
      };

    case 'SUBMIT_START':
      return {
        ...state,
        ui: { ...state.ui, isSubmitting: true }
      };

    case 'SUBMIT_END':
      return {
        ...state,
        ui: { ...state.ui, isSubmitting: false }
      };

    case 'MARK_VALIDATED':
      return {
        ...state,
        validation: {
          ...state.validation,
          hasBeenValidated: true
        }
      };

    default:
      return state;
  }
}

/**
 * FIXED: Validation function - Only show errors for touched fields
 */
const validateEventForm = (
  data: EventFormData,
  touchedFields: Record<string, boolean> = {},
  showAllErrors = false
): { errors: Record<string, string>; isValid: boolean } => {
  const allErrors: Record<string, string> = {};

  // Title validation
  if (!data.title?.trim()) {
    allErrors.title = 'Event title is required';
  } else if (data.title.trim().length < 2) {
    allErrors.title = 'Title must be at least 2 characters';
  } else if (data.title.length > 100) {
    allErrors.title = 'Title cannot exceed 100 characters';
  }

  // Date validation
  if (!data.date) {
    allErrors.date = 'Event date is required';
  } else {
    const eventDate = new Date(data.date);
    if (isNaN(eventDate.getTime())) {
      allErrors.date = 'Invalid date format';
    }
  }

  // Description validation
  if (data.description && data.description.trim().length > 1000) {
    allErrors.description = 'Description cannot exceed 1000 characters';
  }

  // Location validation
  if (data.location && data.location.trim().length > 200) {
    allErrors.location = 'Location cannot exceed 200 characters';
  }

  // Recurring validation
  if (data.is_recurring) {
    if (!data.recurring_config) {
      allErrors.recurring = 'Recurring configuration is required';
    } else {
      const config = data.recurring_config;

      if (!config.frequency) {
        allErrors.recurring = 'Frequency is required';
      }

      if (!config.interval || config.interval < 1 || config.interval > 365) {
        allErrors.recurring = 'Interval must be between 1 and 365';
      }

      if (config.end_date && data.date) {
        const endDate = new Date(config.end_date);
        const startDate = new Date(data.date);

        if (endDate <= startDate) {
          allErrors.recurring = 'End date must be after start date';
        }
      }
    }
  }

  // Only show errors for touched fields OR when showing all errors (on submit)
  const visibleErrors: Record<string, string> = {};
  Object.keys(allErrors).forEach(field => {
    if (showAllErrors || touchedFields[field]) {
      visibleErrors[field] = allErrors[field];
    }
  });

  return {
    errors: visibleErrors,
    isValid: Object.keys(allErrors).length === 0 // Form is valid if no errors exist at all
  };
};

// Virtual scrolling configuration
const VIRTUAL_SCROLL_CONFIG = {
  ITEM_HEIGHT: 200,
  BUFFER_SIZE: 5,
  SCROLL_DEBOUNCE_MS: 16
} as const;

/**
 * Debounce utility function
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

export default function EventManager() {
  const { data: session } = useSession();

  const {
    events,
    loading,
    error,
    filters,
    stats,
    setFilters,
    createEvent,
    updateEvent,
    deleteEvent,
    refreshEvents,
    upcomingEvents,
    todayEvents
  } = useEvents();

  // Initialize form state
  const [formState, dispatchForm] = useReducer(
    eventFormReducer,
    {
      data: createDefaultFormData(),
      validation: {
        errors: {},
        isValid: false,
        touched: {},
        hasBeenValidated: false
      },
      ui: {
        isSubmitting: false,
        showAdvanced: false,
        showRecurringOptions: false
      }
    }
  );

  const [uiState, setUiState] = useState({
    showForm: false,
    editingEvent: null as EnhancedEvent | null,
    selectedView: 'grid' as 'grid' | 'list' | 'calendar',
    showFilters: false
  });

  const formRef = useRef<HTMLFormElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // FIXED: Debounced validation - only for touched fields
  const validateFormDebounced = useMemo(() => {
    return debounce((data: EventFormData, touched: Record<string, boolean>) => {
      const validationResult = validateEventForm(data, touched, false);
      dispatchForm({
        type: 'SET_VALIDATION',
        errors: validationResult.errors,
        isValid: validationResult.isValid
      });
    }, 300);
  }, [dispatchForm]);

  // FIXED: Only validate after user has interacted with form
  useEffect(() => {
    const hasTouchedFields = Object.keys(formState.validation.touched).length > 0;
    if (hasTouchedFields || formState.validation.hasBeenValidated) {
      validateFormDebounced(formState.data, formState.validation.touched);
    }
  }, [formState.data, formState.validation.touched, formState.validation.hasBeenValidated, validateFormDebounced]);

  /**
   * FIXED: Form submission with proper validation
   */
  /**
   * FIXED: Form submission with proper validation
   */
  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark as validated and show all errors
    dispatchForm({ type: 'MARK_VALIDATED' });

    // Final validation with all errors visible
    const finalValidation = validateEventForm(formState.data, {}, true);

    if (!finalValidation.isValid) {
      // Log validation errors to console
      console.log('Validation errors:', finalValidation.errors);

      dispatchForm({
        type: 'SET_VALIDATION',
        errors: finalValidation.errors,
        isValid: false
      });

      // Show specific toast for each validation error
      Object.entries(finalValidation.errors).forEach(([field, error]) => {
        const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
        toast.error(`${fieldName}: ${error}`);
      });

      // Focus first invalid field
      const firstErrorField = Object.keys(finalValidation.errors)[0];
      const fieldElement = formRef.current?.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
      fieldElement?.focus();

      return;
    }

    dispatchForm({ type: 'SUBMIT_START' });

    try {
      const submissionData = {
        ...formState.data,
        recurring_config: formState.data.is_recurring ? formState.data.recurring_config : undefined
      };

      let result;
      if (uiState.editingEvent) {
        result = await updateEvent(uiState.editingEvent.id, submissionData);
      } else {
        result = await createEvent(submissionData);
      }

      if (result.success) {
        dispatchForm({ type: 'RESET_FORM' });
        setUiState(prev => ({
          ...prev,
          showForm: false,
          editingEvent: null
        }));

        toast.success(
          uiState.editingEvent
            ? 'Event updated successfully!'
            : 'Event created successfully!'
        );

        refreshEvents();
      } else {
        if (result.validation_errors && Array.isArray(result.validation_errors)) {
          const errorMap = result.validation_errors.reduce((acc, err) => {
            acc[err.field] = err.message;
            return acc;
          }, {} as Record<string, string>);

          dispatchForm({
            type: 'SET_VALIDATION',
            errors: errorMap,
            isValid: false
          });
        }

        toast.error(result.error || 'Operation failed. Please try again.');
      }
    } catch (submitError) {
      console.error('Form submission error:', submitError);
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      dispatchForm({ type: 'SUBMIT_END' });
    }
  }, [formState.data, uiState.editingEvent, createEvent, updateEvent, refreshEvents]);
  /**
   * FIXED: Edit event handler
   */
  const handleEditEvent = useCallback((event: EnhancedEvent) => {
    const formatDateForInput = (dateString: string, isAllDay: boolean) => {
      const date = new Date(dateString);
      if (isAllDay) {
        return date.toISOString().split('T')[0];
      } else {
        return date.toISOString().slice(0, 16);
      }
    };

    dispatchForm({
      type: 'RESET_FORM',
      initialData: {
        title: event.title,
        date: formatDateForInput(event.date, event.is_all_day),
        description: event.description || '',
        is_recurring: event.is_recurring,
        recurring_config: event.recurring_config,
        category: event.category,
        priority: event.priority,
        location: event.location || '',
        reminder_minutes: event.reminder_minutes,
        is_all_day: event.is_all_day,
        timezone: event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });

    setUiState(prev => ({
      ...prev,
      editingEvent: event,
      showForm: true
    }));
  }, []);

  // Delete handler
  const handleDeleteEvent = useCallback(async (eventId: number) => {
    const eventToDelete = events.find(e => e.id === eventId);
    if (!eventToDelete) {
      toast.error('Event not found');
      return;
    }

    const confirmMessage = `Delete "${eventToDelete.title}"?\n\nThis action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const result = await deleteEvent(eventId);
      if (result.success) {
        toast.success('Event deleted successfully');
        refreshEvents();
      } else {
        toast.error(result.error || 'Failed to delete event');
      }
    } catch (deleteError) {
      console.error('Delete error:', deleteError);
      toast.error('Network error while deleting event');
    }
  }, [events, deleteEvent, refreshEvents]);

  // Search handler
  const handleSearchChange = useCallback((searchTerm: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setFilters({ search_term: searchTerm.trim() });
    }, 300);
  }, [setFilters]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // FIXED: Field change handler
  const handleFieldChange = useCallback((field: keyof EventFormData, value: any) => {
    dispatchForm({ type: 'SET_FIELD', field, value });
    dispatchForm({ type: 'SET_TOUCHED', field });
  }, []);

  // FIXED: Recurring config helper
  const updateRecurringConfig = useCallback((updates: Partial<RecurringEventConfig>) => {
    const currentConfig = formState.data.recurring_config || {
      frequency: 'yearly',
      interval: 1
    };

    const newConfig = { ...currentConfig, ...updates };
    handleFieldChange('recurring_config', newConfig);
  }, [formState.data.recurring_config, handleFieldChange]);

  // Memoized filtered events
  const filteredAndSortedEvents = useMemo(() => {
    let processedEvents = [...events];

    if (filters.search_term) {
      const searchLower = filters.search_term.toLowerCase();
      processedEvents = processedEvents.filter(event =>
        event.title.toLowerCase().includes(searchLower) ||
        event.description?.toLowerCase().includes(searchLower) ||
        event.location?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.category) {
      processedEvents = processedEvents.filter(event =>
        event.category === filters.category
      );
    }

    if (filters.priority) {
      processedEvents = processedEvents.filter(event =>
        event.priority === filters.priority
      );
    }

    return processedEvents.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      if (filters.show_past) {
        return dateB - dateA;
      } else {
        return dateA - dateB;
      }
    });
  }, [events, filters]);

  // Virtual scrolling
  const virtualScrollData = useMemo(() => {
    if (filteredAndSortedEvents.length <= 20) {
      return {
        virtualizedEvents: filteredAndSortedEvents,
        shouldVirtualize: false,
        totalHeight: 0
      };
    }

    const containerHeight = 600;
    const visibleCount = Math.ceil(containerHeight / VIRTUAL_SCROLL_CONFIG.ITEM_HEIGHT);
    const totalHeight = filteredAndSortedEvents.length * VIRTUAL_SCROLL_CONFIG.ITEM_HEIGHT;

    return {
      virtualizedEvents: filteredAndSortedEvents.slice(0, visibleCount + VIRTUAL_SCROLL_CONFIG.BUFFER_SIZE),
      shouldVirtualize: true,
      totalHeight,
      visibleCount
    };
  }, [filteredAndSortedEvents]);

  // Loading state
  if (loading && events.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="bg-gray-200 rounded-xl h-48 animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Event Management</h2>
            {stats && (
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <span>📅 Total: {stats.total_events}</span>
                <span>⏰ Upcoming: {stats.upcoming_events}</span>
                <span>📋 Past: {stats.past_events}</span>
                <span>🔄 Recurring: {stats.recurring_events}</span>
              </div>
            )}
          </div>

          {session && (
            <div className="flex gap-2">
              <button
                onClick={() => setUiState(prev => ({ ...prev, showFilters: !prev.showFilters }))}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {uiState.showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>

              <button
                onClick={() => {
                  dispatchForm({ type: 'RESET_FORM' });
                  setUiState(prev => ({ ...prev, showForm: true, editingEvent: null }));
                }}
                className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors font-medium"
              >
                Add Event
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters section */}
      {uiState.showFilters && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Filter Events</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Events
              </label>
              <input
                type="text"
                placeholder="Search by title, description, or location..."
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={filters.category || ''}
                onChange={(e) => setFilters({ category: e.target.value as any || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                <option value="anniversary">💕 Anniversary</option>
                <option value="birthday">🎂 Birthday</option>
                <option value="date">🌹 Date Night</option>
                <option value="milestone">🏆 Milestone</option>
                <option value="other">📅 Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={filters.priority || ''}
                onChange={(e) => setFilters({ priority: e.target.value as any || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                <option value="">All Priorities</option>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4 mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.show_past || false}
                onChange={(e) => setFilters({ show_past: e.target.checked })}
                className="rounded border-gray-300 text-pink-600 mr-2"
              />
              Show past events
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.show_recurring !== false}
                onChange={(e) => setFilters({ show_recurring: e.target.checked })}
                className="rounded border-gray-300 text-pink-600 mr-2"
              />
              Show recurring events
            </label>
          </div>
        </div>
      )}

      {/* Today's Events */}
      {todayEvents.length > 0 && (
        <div className="bg-gradient-to-r from-pink-100 to-rose-100 rounded-xl p-6 border-2 border-pink-300">
          <h3 className="text-xl font-bold text-pink-800 mb-4">🎉 Today&#39;s Events</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {todayEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onEdit={session ? handleEditEvent : undefined}
                onDelete={session ? handleDeleteEvent : undefined}
                isEditable={!!session}
                size="compact"
              />
            ))}
          </div>
        </div>
      )}

      {/* Events Grid */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        {filteredAndSortedEvents.length > 0 ? (
          <div
            ref={scrollContainerRef}
            className={virtualScrollData.shouldVirtualize ? 'max-h-[600px] overflow-y-auto' : ''}
          >
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              style={virtualScrollData.shouldVirtualize ? { height: virtualScrollData.totalHeight } : undefined}
            >
              {virtualScrollData.virtualizedEvents.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  onEdit={session ? handleEditEvent : undefined}
                  onDelete={session ? handleDeleteEvent : undefined}
                  isEditable={!!session}
                  showDetails={true}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-xl font-medium text-gray-700 mb-2">
              {filters.search_term || filters.category || filters.priority
                ? 'No events match your filters'
                : 'No events yet'
              }
            </h3>
            <p className="text-gray-500 mb-6">
              {filters.search_term || filters.category || filters.priority
                ? 'Try adjusting your filters to see more events'
                : 'Start creating beautiful memories by adding your first event'
              }
            </p>
            {!session && (
              <p className="text-sm text-gray-400">Sign in to create and manage events</p>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center">
            <div className="text-red-400 mr-3">⚠️</div>
            <div>
              <h3 className="text-red-800 font-medium">Error Loading Events</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
              <button
                onClick={refreshEvents}
                className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETELY FIXED: Event Creation/Edit Modal */}
      {uiState.showForm && session && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-800">
                  {uiState.editingEvent ? 'Edit Event' : 'Create New Event'}
                </h3>
                <button
                  onClick={() => {
                    setUiState(prev => ({ ...prev, showForm: false, editingEvent: null }));
                    dispatchForm({ type: 'RESET_FORM' });
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close modal"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form ref={formRef} onSubmit={handleFormSubmit} className="p-6 space-y-6">
              {/* FIXED: Enhanced Form Fields - No premature error display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Event Title *
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    required
                    value={formState.data.title}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors ${formState.validation.errors.title && formState.validation.touched.title
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                      }`}
                    placeholder="Anniversary dinner, Birthday celebration, etc."
                    maxLength={100}
                  />
                  {formState.validation.errors.title && formState.validation.touched.title && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {formState.validation.errors.title}
                    </p>
                  )}
                  <div className="mt-1 text-xs text-gray-500 text-right">
                    {formState.data.title.length}/100 characters
                  </div>
                </div>

                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                    Date & Time *
                  </label>
                  <input
                    id="date"
                    name="date"
                    type={formState.data.is_all_day ? "date" : "datetime-local"}
                    required
                    value={formState.data.date}
                    onChange={(e) => handleFieldChange('date', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors ${formState.validation.errors.date && formState.validation.touched.date
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                      }`}
                  />
                  {formState.validation.errors.date && formState.validation.touched.date && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {formState.validation.errors.date}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
                    Timezone
                  </label>
                  <select
                    id="timezone"
                    name="timezone"
                    value={formState.data.timezone}
                    onChange={(e) => handleFieldChange('timezone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  >
                    <option value="Asia/Ho_Chi_Minh">Ho Chi Minh City (GMT+7)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">New York (EST/EDT)</option>
                    <option value="Europe/London">London (GMT/BST)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                  </select>
                </div>
              </div>

              {/* Category, Priority, and Reminder */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formState.data.category}
                    onChange={(e) => handleFieldChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  >
                    <option value="anniversary">💕 Anniversary</option>
                    <option value="birthday">🎂 Birthday</option>
                    <option value="date">🌹 Date Night</option>
                    <option value="milestone">🏆 Milestone</option>
                    <option value="other">📅 Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    id="priority"
                    name="priority"
                    value={formState.data.priority}
                    onChange={(e) => handleFieldChange('priority', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  >
                    <option value="low">🟢 Low</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🔴 High</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="reminder" className="block text-sm font-medium text-gray-700 mb-2">
                    Reminder
                  </label>
                  <select
                    id="reminder"
                    name="reminder"
                    value={formState.data.reminder_minutes || ''}
                    onChange={(e) => handleFieldChange('reminder_minutes', e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  >
                    <option value="">No reminder</option>
                    <option value={15}>15 minutes before</option>
                    <option value={30}>30 minutes before</option>
                    <option value={60}>1 hour before</option>
                    <option value={1440}>1 day before</option>
                    <option value={10080}>1 week before</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  value={formState.data.location || ''}
                  onChange={(e) => handleFieldChange('location', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors ${formState.validation.errors.location && formState.validation.touched.location
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300'
                    }`}
                  placeholder="Restaurant name, address, or venue"
                  maxLength={200}
                />
                {formState.validation.errors.location && formState.validation.touched.location && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {formState.validation.errors.location}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={formState.data.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none transition-colors ${formState.validation.errors.description && formState.validation.touched.description
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300'
                    }`}
                  placeholder="Add more details about this special event..."
                  maxLength={1000}
                />
                {formState.validation.errors.description && formState.validation.touched.description && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {formState.validation.errors.description}
                  </p>
                )}
                <div className="mt-1 text-xs text-gray-500 text-right">
                  {(formState.data.description || '').length}/1000 characters
                </div>
              </div>

              {/* FIXED: Event Options with proper toggle functionality */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Event Options</span>
                  <button
                    type="button"
                    onClick={() => dispatchForm({
                      type: 'SET_UI_STATE',
                      updates: { showAdvanced: !formState.ui.showAdvanced }
                    })}
                    className="text-sm text-pink-600 hover:text-pink-700 font-medium transition-colors"
                  >
                    {formState.ui.showAdvanced ? 'Hide Advanced' : 'Show Advanced'} Options
                  </button>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formState.data.is_all_day}
                      onChange={(e) => handleFieldChange('is_all_day', e.target.checked)}
                      className="rounded border-gray-300 text-pink-600 mr-2 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">All-day event</span>
                  </label>

                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formState.data.is_recurring}
                      onChange={(e) => {
                        handleFieldChange('is_recurring', e.target.checked);
                        if (!e.target.checked) {
                          handleFieldChange('recurring_config', undefined);
                        }
                      }}
                      className="rounded border-gray-300 text-pink-600 mr-2 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">Recurring event</span>
                  </label>
                </div>
              </div>

              {/* FIXED: Recurring Event Options - properly show/hide */}
              {formState.data.is_recurring && (
                <div className="bg-purple-50 rounded-lg p-4 space-y-4 border border-purple-200">
                  <h4 className="font-medium text-purple-800 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Recurring Event Settings
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Frequency
                      </label>
                      <select
                        value={formState.data.recurring_config?.frequency || 'yearly'}
                        onChange={(e) => updateRecurringConfig({
                          frequency: e.target.value as any,
                          interval: formState.data.recurring_config?.interval || 1
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Repeat every
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={formState.data.recurring_config?.interval || 1}
                          onChange={(e) => updateRecurringConfig({
                            interval: parseInt(e.target.value) || 1
                          })}
                          className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        />
                        <span className="text-sm text-gray-600">
                          {formState.data.recurring_config?.frequency || 'year'}(s)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End date (optional)
                      </label>
                      <input
                        type="date"
                        value={formState.data.recurring_config?.end_date || ''}
                        onChange={(e) => updateRecurringConfig({
                          end_date: e.target.value || undefined
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max occurrences (optional)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        placeholder="e.g., 10"
                        value={formState.data.recurring_config?.max_occurrences || ''}
                        onChange={(e) => updateRecurringConfig({
                          max_occurrences: parseInt(e.target.value) || undefined
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {formState.validation.errors.recurring && (formState.validation.touched.recurring_config || formState.validation.hasBeenValidated) && (
                    <p className="text-sm text-red-600 flex items-center bg-red-50 p-2 rounded">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {formState.validation.errors.recurring}
                    </p>
                  )}
                </div>
              )}

              {/* FIXED: Advanced Options - show/hide properly */}
              {formState.ui.showAdvanced && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4 border border-gray-200">
                  <h4 className="font-medium text-gray-800 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                    </svg>
                    Advanced Settings
                  </h4>

                  <div className="text-sm text-gray-600">
                    <p>Advanced options like custom notifications, attendees, and integration settings will be available in future updates.</p>
                  </div>
                </div>
              )}

              {/* FIXED: Form Actions */}
              <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setUiState(prev => ({ ...prev, showForm: false, editingEvent: null }));
                    dispatchForm({ type: 'RESET_FORM' });
                  }}
                  className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  disabled={formState.ui.isSubmitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={formState.ui.isSubmitting}
                  className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center min-w-[120px] justify-center"
                >
                  {formState.ui.isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {uiState.editingEvent ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    uiState.editingEvent ? 'Update Event' : 'Create Event'
                  )}
                </button>
              </div>

              {/* FIXED: Validation Summary - Only show when form has been validated */}
              {formState.validation.hasBeenValidated && Object.keys(formState.validation.errors).length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                  <h4 className="text-red-800 font-medium mb-2 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Please fix the following errors:
                  </h4>
                  <ul className="text-sm text-red-600 list-disc list-inside space-y-1">
                    {Object.entries(formState.validation.errors).map(([field, error]) => (
                      <li key={field}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}