export interface BaseEvent {
  id: number;
  title: string;
  date: string; // ISO 8601 format
  description?: string;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecurringEventConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // Every N units (e.g., every 2 weeks)
  end_date?: string; // When to stop recurring
  max_occurrences?: number; // Max number of occurrences
  days_of_week?: number[]; // For weekly events (0 = Sunday)
  day_of_month?: number; // For monthly events
}

export interface EnhancedEvent extends BaseEvent {
  recurring_config?: RecurringEventConfig;
  next_occurrence?: string; // Calculated field for recurring events
  category: 'anniversary' | 'birthday' | 'date' | 'milestone' | 'other';
  priority: 'low' | 'medium' | 'high';
  location?: string;
  reminder_minutes?: number; // Minutes before event to remind
  is_all_day: boolean;
  timezone: string; // IANA timezone identifier
}

export interface EventFormData {
  title: string;
  date: string;
  description?: string;
  is_recurring: boolean;
  recurring_config?: RecurringEventConfig;
  category: EnhancedEvent['category'];
  priority: EnhancedEvent['priority'];
  location?: string;
  reminder_minutes?: number;
  is_all_day: boolean;
  timezone: string;
}

export interface EventFilters {
  category?: EnhancedEvent['category'];
  priority?: EnhancedEvent['priority'];
  date_from?: string;
  date_to?: string;
  search_term?: string;
  show_recurring?: boolean;
  show_past?: boolean;
}

export interface EventValidationError {
  field: keyof EventFormData;
  message: string;
}

export interface EventOperationResult {
  success: boolean;
  data?: EnhancedEvent;
  error?: string;
  validation_errors?: EventValidationError[];
}

// Event calculation utilities
export interface EventOccurrence {
  id: string; // Unique identifier for this occurrence
  event_id: number; // Reference to parent event
  date: string;
  is_original: boolean; // True for the first occurrence
  occurrence_index: number; // Which occurrence this is (0-based)
}

export interface EventStats {
  total_events: number;
  upcoming_events: number;
  past_events: number;
  recurring_events: number;
  events_this_month: number;
  next_event?: EnhancedEvent;
}

// API response types
export interface EventListResponse {
  events: EnhancedEvent[];
  total_count: number;
  page: number;
  per_page: number;
  has_next_page: boolean;
  stats?: EventStats;
}

export interface EventDetailResponse {
  event: EnhancedEvent;
  upcoming_occurrences?: EventOccurrence[];
  related_events?: EnhancedEvent[];
}

// Hook return types
export interface UseEventsReturn {
  events: EnhancedEvent[];
  loading: boolean;
  error: string | null;
  stats: EventStats | null;
  filters: EventFilters;
  
  // Actions
  setFilters: (filters: Partial<EventFilters>) => void;
  createEvent: (data: EventFormData) => Promise<EventOperationResult>;
  updateEvent: (id: number, data: Partial<EventFormData>) => Promise<EventOperationResult>;
  deleteEvent: (id: number) => Promise<EventOperationResult>;
  refreshEvents: () => Promise<void>;
  
  // Computed values
  upcomingEvents: EnhancedEvent[];
  pastEvents: EnhancedEvent[];
  todayEvents: EnhancedEvent[];
}

export interface UseEventDetailReturn {
  event: EnhancedEvent | null;
  loading: boolean;
  error: string | null;
  occurrences: EventOccurrence[];
  relatedEvents: EnhancedEvent[];
  
  updateEvent: (data: Partial<EventFormData>) => Promise<EventOperationResult>;
  deleteEvent: () => Promise<EventOperationResult>;
  refresh: () => Promise<void>;
}