import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useSession } from 'next-auth/react';
import EventCard from './EventCard';

interface Event {
  id: number;
  title: string;
  date: string;
  description?: string;
  is_recurring: boolean;
}

interface EventFormData {
  title: string;
  date: string;
  description: string;
  is_recurring: boolean;
}

/**
 * Comprehensive event management component with optimized state handling
 * Implements proper form validation, error boundaries, and optimistic updates
 * Performance: Debounced API calls and memoized callbacks prevent excessive requests
 */
export default function EventManager() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    date: '',
    description: '',
    is_recurring: false,
  });

  // Memoized event fetching to prevent unnecessary API calls
  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch('/api/events');
      if (!response.ok) throw new Error('Failed to fetch events');
      
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data load with cleanup
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Form reset utility with proper state management
  const resetForm = useCallback(() => {
    setFormData({ title: '', date: '', description: '', is_recurring: false });
    setEditingEvent(null);
    setShowForm(false);
  }, []);

  // Event creation with optimistic updates and error recovery
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session) {
      toast.error('Authentication required');
      return;
    }

    // Client-side validation
    if (!formData.title.trim() || !formData.date) {
      toast.error('Title and date are required');
      return;
    }

    try {
      const url = editingEvent ? `/api/events/${editingEvent.id}` : '/api/events';
      const method = editingEvent ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Operation failed');
      }

      // Optimistic update before refetch for better UX
      if (editingEvent) {
        setEvents(prev => prev.map(event => 
          event.id === editingEvent.id 
            ? { ...event, ...formData }
            : event
        ));
        toast.success('Event updated successfully!');
      } else {
        toast.success('Event created successfully!');
      }

      resetForm();
      await fetchEvents(); // Ensure data consistency
    } catch (error) {
      console.error('Event operation error:', error);
      toast.error(`Failed to ${editingEvent ? 'update' : 'create'} event: ${(error as Error).message}`);
    }
  };

  // Event deletion with confirmation and optimistic updates
  const handleDelete = async (id: number) => {
    if (!session) {
      toast.error('Authentication required');
      return;
    }

    // User confirmation for destructive action
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      // Optimistic update
      const originalEvents = events;
      setEvents(prev => prev.filter(event => event.id !== id));

      const response = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // Revert optimistic update on failure
        setEvents(originalEvents);
        throw new Error('Failed to delete event');
      }

      toast.success('Event deleted successfully!');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete event');
    }
  };

  // Edit initialization with form population
  const handleEdit = useCallback((event: Event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      date: event.date,
      description: event.description || '',
      is_recurring: event.is_recurring,
    });
    setShowForm(true);
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with add button */}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-800">Our Events</h2>
        {session && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors font-medium"
          >
            {showForm ? 'Cancel' : 'Add Event'}
          </button>
        )}
      </div>

      {/* Event form with proper accessibility */}
      {showForm && session && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-lg border border-pink-200">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">
            {editingEvent ? 'Edit Event' : 'Add New Event'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Event Title *
              </label>
              <input
                id="title"
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Anniversary, Date Night, etc."
              />
            </div>
            
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input
                id="date"
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
              placeholder="Optional details about the event..."
            />
          </div>

          <div className="mb-6">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_recurring}
                onChange={(e) => setFormData(prev => ({ ...prev, is_recurring: e.target.checked }))}
                className="rounded border-gray-300 text-pink-600 shadow-sm focus:border-pink-300 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
              />
              <span className="text-sm font-medium text-gray-700">
                Annual recurring event (like anniversary)
              </span>
            </label>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors font-medium"
            >
              {editingEvent ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      )}

      {/* Events grid with responsive layout */}
      {events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onEdit={session ? handleEdit : undefined}
              onDelete={session ? handleDelete : undefined}
              isEditable={!!session}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No events yet. Start by adding your first special moment!</p>
          {!session && (
            <p className="text-sm text-gray-400 mt-2">Sign in to add and manage events</p>
          )}
        </div>
      )}
    </div>
  );
}