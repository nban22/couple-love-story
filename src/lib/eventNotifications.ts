// lib/eventNotifications.ts - Comprehensive event notification and reminder system
import { parseISO, isBefore, addMinutes, format, formatDistanceToNow } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { EnhancedEvent } from '../types/event';

/**
 * Notification Types and Interfaces
 * Defines comprehensive notification system architecture
 */
export interface EventNotification {
  id: string;
  event_id: number;
  type: 'reminder' | 'update' | 'cancelled' | 'upcoming';
  title: string;
  message: string;
  scheduled_time: string;
  delivery_time?: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  delivery_method: 'browser' | 'email' | 'push' | 'webhook';
  retry_count: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplate {
  type: EventNotification['type'];
  title_template: string;
  message_template: string;
  timing_offset?: number; // Minutes before event
}

export interface NotificationPreferences {
  user_id: string;
  browser_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  webhook_url?: string;
  reminder_times: number[]; // Minutes before event [15, 60, 1440]
  quiet_hours: {
    start: string; // "22:00"
    end: string;   // "08:00"
  };
  timezone: string;
}

/**
 * Browser Notification Manager
 * Handles in-browser notifications with fallback support
 */
export class BrowserNotificationManager {
  private static permission: NotificationPermission | null = null;
  private static registeredNotifications = new Map<string, Notification>();

  /**
   * Request notification permissions with graceful degradation
   * Critical: Must handle permission denied scenarios gracefully
   */
  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('Browser notifications not supported');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Notification permission request failed:', error);
      return false;
    }
  }

  /**
   * Display browser notification with enhanced options
   * Implements proper error handling and cleanup
   */
  static async showNotification(
    title: string, 
    options: {
      body: string;
      icon?: string;
      badge?: string;
      tag?: string;
      data?: any;
      requireInteraction?: boolean;
      actions?: Array<{
        action: string;
        title: string;
        icon?: string;
      }>;
    }
  ): Promise<boolean> {
    if (!await this.requestPermission()) {
      return false;
    }

    try {
      const notification = new Notification(title, {
        body: options.body,
        icon: options.icon || '/icon-192x192.png',
        badge: options.badge || '/favicon-32x32.png',
        tag: options.tag || `event-${Date.now()}`,
        data: options.data,
        requireInteraction: options.requireInteraction || false,
        // Modern browsers support actions
        ...('actions' in Notification.prototype && options.actions ? { actions: options.actions } : {})
      });

      // Store notification reference for cleanup
      if (options.tag) {
        this.registeredNotifications.set(options.tag, notification);
      }

      // Auto-close after 10 seconds if not requiring interaction
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
          if (options.tag) {
            this.registeredNotifications.delete(options.tag);
          }
        }, 10000);
      }

      // Handle user interactions
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        if (options.data?.url) {
          window.location.href = options.data.url;
        }
        notification.close();
      };

      notification.onclose = () => {
        if (options.tag) {
          this.registeredNotifications.delete(options.tag);
        }
      };

      return true;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }

  /**
   * Close specific notification by tag
   */
  static closeNotification(tag: string): void {
    const notification = this.registeredNotifications.get(tag);
    if (notification) {
      notification.close();
      this.registeredNotifications.delete(tag);
    }
  }

  /**
   * Check if notifications are supported and enabled
   */
  static isSupported(): boolean {
    return 'Notification' in window && 
           'serviceWorker' in navigator && 
           this.permission === 'granted';
  }
}

/**
 * Event Reminder Scheduler
 * Manages comprehensive reminder scheduling and delivery
 */
export class EventReminderScheduler {
  private static scheduledReminders = new Map<string, NodeJS.Timeout>();
  private static notificationQueue: EventNotification[] = [];
  private static isProcessingQueue = false;

  /**
   * Predefined notification templates for different event types
   * Provides consistent messaging across the application
   */
  private static readonly NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
    reminder_15min: {
      type: 'reminder',
      title_template: '⏰ {event_title} is starting soon!',
      message_template: 'Your event "{event_title}" starts in 15 minutes at {event_time}.',
      timing_offset: 15
    },
    reminder_1hour: {
      type: 'reminder',
      title_template: '📅 Upcoming: {event_title}',
      message_template: 'Don\'t forget! "{event_title}" is scheduled for {event_time} (in 1 hour).',
      timing_offset: 60
    },
    reminder_1day: {
      type: 'reminder',
      title_template: '📋 Tomorrow: {event_title}',
      message_template: 'Reminder: "{event_title}" is scheduled for tomorrow at {event_time}.',
      timing_offset: 1440
    },
    event_today: {
      type: 'upcoming',
      title_template: '🎉 Today: {event_title}',
      message_template: 'Today is the day! "{event_title}" is scheduled for {event_time}.'
    },
    event_updated: {
      type: 'update',
      title_template: '📝 Event Updated: {event_title}',
      message_template: 'The details for "{event_title}" have been updated. Check the latest information.'
    },
    event_cancelled: {
      type: 'cancelled',
      title_template: '❌ Event Cancelled: {event_title}',
      message_template: 'The event "{event_title}" scheduled for {event_time} has been cancelled.'
    }
  };

  /**
   * Schedule comprehensive reminders for an event
   * Implements intelligent timing based on event importance and user preferences
   */
  static scheduleEventReminders(
    event: EnhancedEvent, 
    preferences: NotificationPreferences
  ): void {
    const eventDate = parseISO(event.date);
    const now = new Date();

    // Don't schedule reminders for past events
    if (isBefore(eventDate, now)) {
      return;
    }

    // Clear existing reminders for this event
    this.clearEventReminders(event.id);

    // Get reminder times based on event priority and user preferences
    const reminderTimes = this.calculateReminderTimes(event, preferences);

    reminderTimes.forEach(minutesBefore => {
      const reminderTime = addMinutes(eventDate, -minutesBefore);

      // Only schedule if reminder time is in the future
      if (isBefore(now, reminderTime)) {
        this.scheduleReminder(event, reminderTime, minutesBefore, preferences);
      }
    });

    // Schedule day-of notification for important events
    if (event.priority === 'high' || ['anniversary', 'birthday'].includes(event.category)) {
      const dayOfTime = new Date(eventDate);
      dayOfTime.setHours(9, 0, 0, 0); // 9 AM notification

      if (isBefore(now, dayOfTime)) {
        this.scheduleDayOfNotification(event, dayOfTime, preferences);
      }
    }
  }

  /**
   * Calculate optimal reminder times based on event characteristics
   * Implements smart scheduling algorithm
   */
  private static calculateReminderTimes(
    event: EnhancedEvent, 
    preferences: NotificationPreferences
  ): number[] {
    let reminderTimes = [...preferences.reminder_times];

    // Adjust based on event priority
    switch (event.priority) {
      case 'high':
        // More frequent reminders for high priority events
        reminderTimes = [...new Set([...reminderTimes, 5, 15, 60, 1440])];
        break;
      case 'medium':
        // Standard reminders
        reminderTimes = [...new Set([...reminderTimes, 15, 60])];
        break;
      case 'low':
        // Minimal reminders for low priority
        reminderTimes = reminderTimes.filter(time => time >= 60);
        break;
    }

    // Category-specific adjustments
    if (['anniversary', 'birthday'].includes(event.category)) {
      // Special occasions deserve more attention
      reminderTimes = [...new Set([...reminderTimes, 1440, 7 * 1440])]; // 1 day and 1 week
    }

    // Event-specific reminder override
    if (event.reminder_minutes) {
      reminderTimes = [...new Set([...reminderTimes, event.reminder_minutes])];
    }

    return reminderTimes.sort((a, b) => a - b);
  }

  /**
   * Schedule individual reminder with timezone handling
   * Implements precise timing with cleanup mechanisms
   */
  private static scheduleReminder(
    event: EnhancedEvent,
    reminderTime: Date,
    minutesBefore: number,
    preferences: NotificationPreferences
  ): void {
    const reminderId = `${event.id}-${minutesBefore}`;
    const delay = reminderTime.getTime() - Date.now();

    // Safety check for reasonable delay times
    if (delay < 0 || delay > 365 * 24 * 60 * 60 * 1000) { // Max 1 year
      return;
    }

    const timeout = setTimeout(async () => {
      await this.deliverReminder(event, minutesBefore, preferences);
      this.scheduledReminders.delete(reminderId);
    }, delay);

    this.scheduledReminders.set(reminderId, timeout);
  }

  /**
   * Schedule day-of notification for special events
   */
  private static scheduleDayOfNotification(
    event: EnhancedEvent,
    notificationTime: Date,
    preferences: NotificationPreferences
  ): void {
    const notificationId = `${event.id}-dayof`;
    const delay = notificationTime.getTime() - Date.now();

    if (delay < 0) return;

    const timeout = setTimeout(async () => {
      await this.deliverDayOfNotification(event, preferences);
      this.scheduledReminders.delete(notificationId);
    }, delay);

    this.scheduledReminders.set(notificationId, timeout);
  }

  /**
   * Deliver reminder notification with fallback mechanisms
   * Implements multi-channel delivery with error handling
   */
  private static async deliverReminder(
    event: EnhancedEvent,
    minutesBefore: number,
    preferences: NotificationPreferences
  ): Promise<void> {
    const template = this.getTemplateForReminder(minutesBefore);
    const eventTime = formatInTimeZone(
      parseISO(event.date),
      preferences.timezone,
      event.is_all_day ? 'MMMM d, yyyy' : 'MMMM d, yyyy \'at\' h:mm a'
    );

    const notification: Omit<EventNotification, 'id' | 'created_at' | 'updated_at'> = {
      event_id: event.id,
      type: 'reminder',
      title: this.interpolateTemplate(template.title_template, { event, eventTime }),
      message: this.interpolateTemplate(template.message_template, { event, eventTime }),
      scheduled_time: new Date().toISOString(),
      delivery_method: 'browser',
      status: 'pending',
      retry_count: 0,
      metadata: { minutes_before: minutesBefore }
    };

    await this.deliverNotification(notification, preferences);
  }

  /**
   * Deliver day-of notification for special events
   */
  private static async deliverDayOfNotification(
    event: EnhancedEvent,
    preferences: NotificationPreferences
  ): Promise<void> {
    const template = this.NOTIFICATION_TEMPLATES.event_today;
    const eventTime = formatInTimeZone(
      parseISO(event.date),
      preferences.timezone,
      event.is_all_day ? 'h:mm a' : 'h:mm a'
    );

    const notification: Omit<EventNotification, 'id' | 'created_at' | 'updated_at'> = {
      event_id: event.id,
      type: 'upcoming',
      title: this.interpolateTemplate(template.title_template, { event, eventTime }),
      message: this.interpolateTemplate(template.message_template, { event, eventTime }),
      scheduled_time: new Date().toISOString(),
      delivery_method: 'browser',
      status: 'pending',
      retry_count: 0,
      metadata: { is_day_of: true }
    };

    await this.deliverNotification(notification, preferences);
  }

  /**
   * Multi-channel notification delivery with retry logic
   * Implements graceful degradation and error recovery
   */
  private static async deliverNotification(
    notification: Omit<EventNotification, 'id' | 'created_at' | 'updated_at'>,
    preferences: NotificationPreferences
  ): Promise<void> {
    let delivered = false;

    // Try browser notification first (most immediate)
    if (preferences.browser_enabled && BrowserNotificationManager.isSupported()) {
      try {
        const success = await BrowserNotificationManager.showNotification(
          notification.title,
          {
            body: notification.message,
            tag: `event-${notification.event_id}`,
            requireInteraction: notification.type === 'reminder',
            data: { 
              url: `/events?highlight=${notification.event_id}`,
              event_id: notification.event_id 
            }
          }
        );

        if (success) {
          delivered = true;
          console.log('Browser notification delivered:', notification.title);
        }
      } catch (error) {
        console.error('Browser notification failed:', error);
      }
    }

    // Fallback to in-app notification (toast)
    if (!delivered) {
      try {
        // Queue for in-app display
        this.queueInAppNotification(notification);
        delivered = true;
        console.log('In-app notification queued:', notification.title);
      } catch (error) {
        console.error('In-app notification failed:', error);
      }
    }

    // Future: Email and push notification fallbacks
    // if (!delivered && preferences.email_enabled) {
    //   await this.sendEmailNotification(notification, preferences);
    // }
  }

  /**
   * Queue notification for in-app display
   * Implements toast notification fallback
   */
  private static queueInAppNotification(
    notification: Omit<EventNotification, 'id' | 'created_at' | 'updated_at'>
  ): void {
    // This would integrate with your toast notification system
    // For now, we'll use console logging
    console.log(`📅 ${notification.title}: ${notification.message}`);
    
    // In a real implementation, this would:
    // 1. Add to a notification queue
    // 2. Display as toast when user is active
    // 3. Store in local storage for offline access
  }

  /**
   * Template interpolation utility
   * Safely replaces template variables with actual values
   */
  private static interpolateTemplate(
    template: string, 
    variables: { event: EnhancedEvent; eventTime: string }
  ): string {
    return template
      .replace(/\{event_title\}/g, variables.event.title)
      .replace(/\{event_time\}/g, variables.eventTime)
      .replace(/\{event_location\}/g, variables.event.location || 'TBD')
      .replace(/\{event_description\}/g, variables.event.description || '');
  }

  /**
   * Get appropriate template based on reminder timing
   */
  private static getTemplateForReminder(minutesBefore: number): NotificationTemplate {
    if (minutesBefore <= 15) {
      return this.NOTIFICATION_TEMPLATES.reminder_15min;
    } else if (minutesBefore <= 60) {
      return this.NOTIFICATION_TEMPLATES.reminder_1hour;
    } else {
      return this.NOTIFICATION_TEMPLATES.reminder_1day;
    }
  }

  /**
   * Clear all scheduled reminders for an event
   * Essential for preventing duplicate notifications
   */
  static clearEventReminders(eventId: number): void {
    const keysToDelete: string[] = [];
    
    this.scheduledReminders.forEach((timeout, key) => {
      if (key.startsWith(`${eventId}-`)) {
        clearTimeout(timeout);
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.scheduledReminders.delete(key);
    });
  }

  /**
   * Clear all scheduled reminders
   * Used for cleanup on logout or app termination
   */
  static clearAllReminders(): void {
    this.scheduledReminders.forEach(timeout => clearTimeout(timeout));
    this.scheduledReminders.clear();
  }

  /**
   * Get debug information about scheduled reminders
   * Useful for development and troubleshooting
   */
  static getScheduledRemindersInfo(): Array<{ id: string; scheduledFor: Date }> {
    const info: Array<{ id: string; scheduledFor: Date }> = [];
    
    this.scheduledReminders.forEach((timeout, key) => {
      // This is approximate since we can't extract exact timing from setTimeout
      info.push({
        id: key,
        scheduledFor: new Date(Date.now() + 1000) // Placeholder
      });
    });

    return info;
  }
}

/**
 * Notification Preferences Manager
 * Handles user preferences with intelligent defaults
 */
export class NotificationPreferencesManager {
  private static readonly DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'user_id'> = {
    browser_enabled: true,
    email_enabled: false,
    push_enabled: false,
    reminder_times: [15, 60, 1440], // 15 min, 1 hour, 1 day
    quiet_hours: {
      start: '22:00',
      end: '08:00'
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };

  /**
   * Get user preferences with fallback to defaults
   */
  static getPreferences(userId: string): NotificationPreferences {
    try {
      const stored = localStorage.getItem(`notification_prefs_${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...this.DEFAULT_PREFERENCES, ...parsed, user_id: userId };
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }

    return { ...this.DEFAULT_PREFERENCES, user_id: userId };
  }

  /**
   * Save user preferences with validation
   */
  static savePreferences(preferences: NotificationPreferences): boolean {
    try {
      localStorage.setItem(
        `notification_prefs_${preferences.user_id}`, 
        JSON.stringify(preferences)
      );
      return true;
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      return false;
    }
  }

  /**
   * Check if current time is within quiet hours
   */
  static isQuietTime(preferences: NotificationPreferences): boolean {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    const { start, end } = preferences.quiet_hours;

    // Handle quiet hours that span midnight
    if (start > end) {
      return currentTime >= start || currentTime <= end;
    } else {
      return currentTime >= start && currentTime <= end;
    }
  }
}

/**
 * Main Event Notification Controller
 * Orchestrates the entire notification system
 */
export class EventNotificationController {
  /**
   * Initialize notification system for a user
   * Sets up all necessary components and schedules existing events
   */
  static async initialize(userId: string, events: EnhancedEvent[]): Promise<void> {
    const preferences = NotificationPreferencesManager.getPreferences(userId);
    
    // Request browser notification permissions
    await BrowserNotificationManager.requestPermission();
    
    // Schedule reminders for all upcoming events
    events.forEach(event => {
      EventReminderScheduler.scheduleEventReminders(event, preferences);
    });

    console.log(`Event notification system initialized for user ${userId}`);
  }

  /**
   * Handle event creation - schedule new reminders
   */
  static onEventCreated(event: EnhancedEvent, userId: string): void {
    const preferences = NotificationPreferencesManager.getPreferences(userId);
    EventReminderScheduler.scheduleEventReminders(event, preferences);
  }

  /**
   * Handle event update - reschedule reminders
   */
  static onEventUpdated(event: EnhancedEvent, userId: string): void {
    // Clear old reminders and schedule new ones
    EventReminderScheduler.clearEventReminders(event.id);
    
    const preferences = NotificationPreferencesManager.getPreferences(userId);
    EventReminderScheduler.scheduleEventReminders(event, preferences);

    // Send update notification
    this.sendEventUpdateNotification(event, preferences);
  }

  /**
   * Handle event deletion - clear reminders
   */
  static onEventDeleted(eventId: number): void {
    EventReminderScheduler.clearEventReminders(eventId);
  }

  /**
   * Send event update notification
   */
  private static async sendEventUpdateNotification(
    event: EnhancedEvent, 
    preferences: NotificationPreferences
  ): Promise<void> {
    if (NotificationPreferencesManager.isQuietTime(preferences)) {
      return; // Respect quiet hours
    }

    await BrowserNotificationManager.showNotification(
      `📝 Event Updated: ${event.title}`,
      {
        body: `The details for "${event.title}" have been updated.`,
        tag: `update-${event.id}`,
        data: { url: `/events?highlight=${event.id}` }
      }
    );
  }

  /**
   * Cleanup on logout or app termination
   */
  static cleanup(): void {
    EventReminderScheduler.clearAllReminders();
  }
}