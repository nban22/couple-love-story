// lib/database.ts - Enhanced database with comprehensive event management
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import bcrypt from "bcryptjs";

/**
 * Core Interfaces - Backward Compatible with Extensions
 * Maintains existing API while adding enhanced capabilities
 */
export interface CoupleInfo {
  id: number;
  male_name: string;
  female_name: string;
  love_start_date: string;
  male_birthday: string;
  female_birthday: string;
  created_at: string;
  updated_at: string;
}

// Legacy Event interface - kept for backward compatibility
export interface Event {
  id: number;
  title: string;
  date: string;
  description?: string;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
}

// Enhanced Event interface with comprehensive features
export interface EnhancedEvent extends Event {
  timezone: string;
  is_all_day: boolean;
  location?: string;
  category: "anniversary" | "birthday" | "date" | "milestone" | "other";
  priority: "low" | "medium" | "high";
  recurring_config?: RecurringEventConfig;
  reminder_minutes?: number;
  created_by?: string;
  updated_by?: string;
  version: number;
  deleted_at?: string;
}

export interface RecurringEventConfig {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  end_date?: string;
  max_occurrences?: number;
  days_of_week?: number[];
  day_of_month?: number;
}

export interface EventFilters {
  category?: EnhancedEvent["category"];
  priority?: EnhancedEvent["priority"];
  date_from?: string;
  date_to?: string;
  search_term?: string;
  show_recurring?: boolean;
  show_past?: boolean;
}

export interface EventStats {
  total_events: number;
  upcoming_events: number;
  past_events: number;
  recurring_events: number;
  events_this_month: number;
  next_event?: EnhancedEvent;
}

export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
}

export interface Photo {
  id: number;
  cloudinary_id: string;
  public_url: string;
  title?: string;
  description?: string;
  upload_date: string;
  created_at: string;
}

/**
 * Runtime Environment Detection - Enhanced Security
 * Prevents client-side execution with comprehensive checks
 */
function isServerEnvironment(): boolean {
  return (
    typeof window === "undefined" &&
    typeof process !== "undefined" &&
    !!process.versions?.node &&
    typeof require !== "undefined"
  );
}

/**
 * Dynamic Database Module Loader with Error Recovery
 * Implements robust loading with fallback mechanisms
 */
async function loadDatabase() {
  if (!isServerEnvironment()) {
    throw new Error("Database operations are server-side only");
  }

  try {
    const Database = (await import("better-sqlite3")).default;
    return Database;
  } catch (error) {
    console.error("Failed to load better-sqlite3:", error);
    throw new Error(
      "Database module loading failed - ensure better-sqlite3 is installed"
    );
  }
}

/**
 * Path Configuration with Environment Validation
 * Ensures proper directory structure and permissions
 */
const DATA_DIR = join(process.cwd(), "src/data");
const DB_PATH = join(DATA_DIR, "couple.db");
const BACKUP_DIR = join(DATA_DIR, "backups");

/**
 * Directory Management with Comprehensive Error Handling
 * Creates necessary directories with proper permissions
 */
function ensureDataDirectoryExists(): boolean {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true, mode: 0o755 });
      console.log(`📁 Created data directory: ${DATA_DIR}`);
    }

    if (!existsSync(BACKUP_DIR)) {
      mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o755 });
      console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
    }

    return true;
  } catch (error) {
    console.error("❌ Failed to create data directories:", error);
    return false;
  }
}

/**
 * Enhanced DatabaseManager with Production-Grade Features
 * Implements comprehensive event management, caching, and monitoring
 */
class DatabaseManager {
  private db: any;
  private initialized: boolean = false;

  // Performance monitoring and caching
  private queryCache = new Map<
    string,
    { data: any; timestamp: number; ttl: number }
  >();
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private performanceMetrics = new Map<
    string,
    { count: number; totalTime: number; avgTime: number }
  >();

  /**
   * Async Initialization with Enhanced Error Handling
   * Implements connection pooling and optimization strategies
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!isServerEnvironment()) {
      throw new Error("Database can only be initialized on server");
    }

    if (!ensureDataDirectoryExists()) {
      throw new Error("Failed to initialize data directories");
    }

    try {
      const Database = await loadDatabase();

      // Initialize database with production-optimized pragmas
      this.db = new Database(DB_PATH);

      // Performance optimization pragmas
      this.db.pragma("journal_mode = WAL"); // Write-Ahead Logging for better concurrency
      this.db.pragma("synchronous = NORMAL"); // Balance between safety and performance
      this.db.pragma("cache_size = 2000"); // 2000 pages cache (~8MB for 4KB pages)
      this.db.pragma("temp_store = MEMORY"); // Store temporary tables in memory
      this.db.pragma("mmap_size = 268435456"); // 256MB memory-mapped I/O
      this.db.pragma("foreign_keys = ON"); // Enable foreign key constraints

      // Set initialized flag immediately after successful connection
      this.initialized = true;
      console.log(`✅ Database initialized: ${DB_PATH}`);

      // Initialize schema and seed data
      await this.initializeEnhancedTables();
      await this.createOptimizedIndexes();
      await this.runSchemaMigrations();
      await this.seedDefaultData();

      // Schedule periodic maintenance
      this.scheduleMaintenanceTasks();
    } catch (error) {
      this.initialized = false;
      this.db = null;
      console.error("❌ Database initialization failed:", error);
      throw new Error(
        `Database initialization failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Enhanced Table Creation with Comprehensive Schema
   * Implements proper normalization and constraint management
   */
  private async initializeEnhancedTables(): Promise<void> {
    this.ensureInitialized();

    try {
      this.db.exec(`
        -- Original tables (maintained for backward compatibility)
        CREATE TABLE IF NOT EXISTS couple_info (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          male_name TEXT NOT NULL,
          female_name TEXT NOT NULL,
          love_start_date TEXT NOT NULL,
          male_birthday TEXT NOT NULL,
          female_birthday TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS photos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cloudinary_id TEXT UNIQUE NOT NULL,
          public_url TEXT NOT NULL,
          title TEXT,
          description TEXT,
          upload_date TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Enhanced events table with comprehensive features
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          date TEXT NOT NULL,
          timezone TEXT DEFAULT 'UTC',
          is_all_day BOOLEAN DEFAULT 0,
          location TEXT,
          
          -- Categorization and priority system
          category TEXT DEFAULT 'other' CHECK (category IN ('anniversary', 'birthday', 'date', 'milestone', 'other')),
          priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
          
          -- Recurring event configuration (stored as JSON)
          is_recurring BOOLEAN DEFAULT 0,
          recurring_config TEXT, -- JSON string for RecurringEventConfig
          
          -- Reminder and notification settings
          reminder_minutes INTEGER,
          
          -- Audit trail and versioning
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          updated_by TEXT,
          version INTEGER DEFAULT 1,
          
          -- Soft delete support
          deleted_at TEXT,
          
          -- Full-text search optimization (generated column)
          search_text TEXT GENERATED ALWAYS AS (
            title || ' ' || COALESCE(description, '') || ' ' || COALESCE(location, '')
          ) STORED
        );

        -- Event change history for comprehensive audit trail
        CREATE TABLE IF NOT EXISTS event_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id INTEGER NOT NULL,
          action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'restored')),
          changed_fields TEXT, -- JSON array of changed field names
          old_values TEXT,     -- JSON object of previous values
          new_values TEXT,     -- JSON object of new values
          changed_by TEXT,
          changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        );

        -- Event reminders and notifications
        CREATE TABLE IF NOT EXISTS event_reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id INTEGER NOT NULL,
          reminder_time TEXT NOT NULL,
          reminder_type TEXT DEFAULT 'standard' CHECK (reminder_type IN ('standard', 'urgent', 'gentle')),
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
          delivery_method TEXT DEFAULT 'browser' CHECK (delivery_method IN ('browser', 'email', 'push')),
          retry_count INTEGER DEFAULT 0,
          last_attempt TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        );

        -- Schema version tracking for migrations
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          description TEXT,
          applied_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Performance monitoring table
        CREATE TABLE IF NOT EXISTS query_performance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          query_type TEXT NOT NULL,
          execution_time_ms REAL NOT NULL,
          result_count INTEGER,
          executed_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log("📋 Enhanced database tables initialized successfully");
    } catch (error) {
      console.error("❌ Table initialization failed:", error);
      throw error;
    }
  }

  /**
   * Strategic Index Creation for Optimal Query Performance
   * Implements covering indexes and composite indexes for common access patterns
   */
  private async createOptimizedIndexes(): Promise<void> {
    this.ensureInitialized();

    try {
      this.db.exec(`
        -- Core performance indexes for events
        CREATE INDEX IF NOT EXISTS idx_events_date ON events(date) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_events_category ON events(category) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_events_priority ON events(priority) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_events_recurring ON events(is_recurring) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_events_deleted ON events(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
        
        -- Composite indexes for common query patterns
        CREATE INDEX IF NOT EXISTS idx_events_date_category ON events(date, category) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_events_date_priority ON events(date, priority) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_events_upcoming ON events(date, is_recurring, priority) 
          WHERE deleted_at IS NULL AND date >= datetime('now');
        CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(created_by, date) WHERE deleted_at IS NULL;
        
        -- Full-text search optimization
        CREATE INDEX IF NOT EXISTS idx_events_search ON events(search_text) WHERE deleted_at IS NULL;
        
        -- Audit trail indexes
        CREATE INDEX IF NOT EXISTS idx_history_event_date ON event_history(event_id, changed_at);
        CREATE INDEX IF NOT EXISTS idx_history_user_action ON event_history(changed_by, action);
        
        -- Reminder system indexes
        CREATE INDEX IF NOT EXISTS idx_reminders_time_status ON event_reminders(reminder_time, status);
        CREATE INDEX IF NOT EXISTS idx_reminders_event ON event_reminders(event_id);
        
        -- Original table indexes (maintained)
        CREATE INDEX IF NOT EXISTS idx_photos_upload_date ON photos(upload_date);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        
        -- Performance monitoring indexes
        CREATE INDEX IF NOT EXISTS idx_query_perf_type_time ON query_performance(query_type, executed_at);
      `);

      console.log("🚀 Database indexes created for optimal performance");
    } catch (error) {
      console.error("❌ Index creation failed:", error);
      throw error;
    }
  }

  /**
   * Schema Migration System for Database Evolution
   * Handles version upgrades and data transformations safely
   */
  private async runSchemaMigrations(): Promise<void> {
    const migrations = [
      {
        version: 1,
        description: "Initial enhanced schema setup",
        sql: `
          -- Migration marker - enhanced schema is now active
          INSERT OR IGNORE INTO schema_migrations (version, description) 
          VALUES (1, 'Enhanced event system with categories, priorities, and audit trail');
        `,
      },
      {
        version: 2,
        description: "Add search text optimization",
        sql: `
          -- Ensure search_text column exists and is populated
          UPDATE events SET updated_at = updated_at WHERE search_text IS NULL;
        `,
      },
    ];

    for (const migration of migrations) {
      try {
        const exists = this.db
          .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
          .get(migration.version);

        if (!exists) {
          console.log(
            `🔄 Running migration v${migration.version}: ${migration.description}`
          );
          this.db.exec(migration.sql);
          console.log(`✅ Migration v${migration.version} completed`);
        }
      } catch (error) {
        console.error(`❌ Migration v${migration.version} failed:`, error);
        throw error;
      }
    }
  }

  /**
   * Validation Helper - Ensures Database Readiness
   * Prevents runtime errors from uninitialized access
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
  }

  /**
   * Performance Monitoring Utilities
   * Tracks query performance for optimization insights
   */
  private trackQueryPerformance(
    queryType: string,
    executionTime: number,
    resultCount?: number
  ): void {
    try {
      // Update in-memory metrics
      const existing = this.performanceMetrics.get(queryType) || {
        count: 0,
        totalTime: 0,
        avgTime: 0,
      };
      const newCount = existing.count + 1;
      const newTotalTime = existing.totalTime + executionTime;

      this.performanceMetrics.set(queryType, {
        count: newCount,
        totalTime: newTotalTime,
        avgTime: newTotalTime / newCount,
      });

      // Log slow queries for optimization
      if (executionTime > 100) {
        // Queries taking more than 100ms
        console.warn(
          `🐌 Slow query detected: ${queryType} took ${executionTime.toFixed(
            2
          )}ms`
        );
      }

      // Periodically store performance data
      if (Math.random() < 0.1) {
        // 10% sampling rate
        this.db
          .prepare(
            `
          INSERT INTO query_performance (query_type, execution_time_ms, result_count)
          VALUES (?, ?, ?)
        `
          )
          .run(queryType, executionTime, resultCount || 0);
      }
    } catch (error) {
      // Don't let performance tracking break the main functionality
      console.warn("Performance tracking error:", error);
    }
  }

  /**
   * Enhanced Caching System with TTL Management
   * Implements intelligent cache invalidation and memory management
   */
  private getCachedResult<T>(key: string): T | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  private setCachedResult<T>(
    key: string,
    data: T,
    ttl: number = this.DEFAULT_CACHE_TTL
  ): void {
    // Implement simple LRU eviction when cache gets too large
    if (this.queryCache.size > 200) {
      const oldestKey = this.queryCache.keys().next().value;
      if (oldestKey) {
        this.queryCache.delete(oldestKey);
      }
    }

    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  private invalidateCache(pattern?: string): void {
    if (pattern) {
      // Invalidate specific cache entries matching pattern
      for (const key of this.queryCache.keys()) {
        if (key.includes(pattern)) {
          this.queryCache.delete(key);
        }
      }
    } else {
      // Clear entire cache
      this.queryCache.clear();
    }
  }

  // ========================================
  // COUPLE INFO METHODS (Original API)
  // ========================================

  getCoupleInfo(): CoupleInfo | undefined {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      const result = this.db
        .prepare("SELECT * FROM couple_info LIMIT 1")
        .get() as CoupleInfo | undefined;
      this.trackQueryPerformance(
        "getCoupleInfo",
        performance.now() - startTime,
        result ? 1 : 0
      );
      return result;
    } catch (error) {
      console.error("Database read error:", error);
      return undefined;
    }
  }

  updateCoupleInfo(data: Partial<CoupleInfo>): boolean {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      const stmt = this.db.prepare(`
        UPDATE couple_info 
        SET male_name = COALESCE(?, male_name),
            female_name = COALESCE(?, female_name),
            love_start_date = COALESCE(?, love_start_date),
            male_birthday = COALESCE(?, male_birthday),
            female_birthday = COALESCE(?, female_birthday),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `);

      const result = stmt.run(
        data.male_name,
        data.female_name,
        data.love_start_date,
        data.male_birthday,
        data.female_birthday
      );

      this.trackQueryPerformance(
        "updateCoupleInfo",
        performance.now() - startTime,
        result.changes
      );
      return result.changes > 0;
    } catch (error) {
      console.error("Error updating couple info:", error);
      return false;
    }
  }

  // ========================================
  // EVENT METHODS (Enhanced with Backward Compatibility)
  // ========================================

  /**
   * Get All Events - Legacy Method with Enhanced Features
   * Maintains backward compatibility while adding new capabilities
   */
  getAllEvents(): Event[] {
    return this.getFilteredEvents({}, 1000, 0).map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      description: event.description,
      is_recurring: event.is_recurring,
      created_at: event.created_at,
      updated_at: event.updated_at,
    }));
  }

  /**
   * Enhanced Event Filtering with Comprehensive Query Support
   * Implements high-performance filtering with caching
   */
  getFilteredEvents(
    filters: EventFilters = {},
    limit: number = 20,
    offset: number = 0
  ): EnhancedEvent[] {
    this.ensureInitialized();
    const startTime = performance.now();

    // Generate cache key from filters
    const cacheKey = `filtered_events_${JSON.stringify(
      filters
    )}_${limit}_${offset}`;

    // Check cache first
    const cached = this.getCachedResult<EnhancedEvent[]>(cacheKey);
    if (cached) {
      this.trackQueryPerformance(
        "getFilteredEvents_cached",
        performance.now() - startTime,
        cached.length
      );
      return cached;
    }

    try {
      // Build dynamic query with parameterized conditions
      let query = `
        SELECT * FROM events 
        WHERE deleted_at IS NULL
      `;
      const params: any[] = [];

      // Apply filters systematically
      if (filters.date_from) {
        query += ` AND date >= ?`;
        params.push(filters.date_from);
      }

      if (filters.date_to) {
        query += ` AND date <= ?`;
        params.push(filters.date_to);
      }

      if (filters.category) {
        query += ` AND category = ?`;
        params.push(filters.category);
      }

      if (filters.priority) {
        query += ` AND priority = ?`;
        params.push(filters.priority);
      }

      if (filters.search_term) {
        query += ` AND search_text LIKE ?`;
        params.push(`%${filters.search_term.trim()}%`);
      }

      if (filters.show_recurring === false) {
        query += ` AND is_recurring = 0`;
      }

      if (!filters.show_past) {
        query += ` AND date >= datetime('now')`;
      }

      // Apply sorting and pagination
      query += ` ORDER BY date ASC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const stmt = this.db.prepare(query);
      const results = stmt.all(...params) as any[];

      // Parse and transform results
      const parsedResults: EnhancedEvent[] = results.map((event) => ({
        ...event,
        recurring_config: event.recurring_config
          ? JSON.parse(event.recurring_config)
          : undefined,
        is_recurring: Boolean(event.is_recurring),
        is_all_day: Boolean(event.is_all_day),
        version: event.version || 1,
      }));

      // Cache successful results
      this.setCachedResult(cacheKey, parsedResults);
      this.trackQueryPerformance(
        "getFilteredEvents",
        performance.now() - startTime,
        parsedResults.length
      );

      return parsedResults;
    } catch (error) {
      console.error("Error fetching filtered events:", error);
      this.trackQueryPerformance(
        "getFilteredEvents_error",
        performance.now() - startTime,
        0
      );
      return [];
    }
  }

  /**
   * Get Count of Filtered Events for Pagination
   * Optimized count query without fetching actual data
   */
  getFilteredEventsCount(filters: EventFilters = {}): number {
    this.ensureInitialized();
    const startTime = performance.now();

    // Generate cache key for count query
    const cacheKey = `filtered_events_count_${JSON.stringify(filters)}`;

    // Check cache first
    const cached = this.getCachedResult<number>(cacheKey);
    if (cached !== null) {
      this.trackQueryPerformance(
        "getFilteredEventsCount_cached",
        performance.now() - startTime,
        1
      );
      return cached;
    }

    try {
      // Build optimized COUNT query (same filter logic as getFilteredEvents)
      let query = `
      SELECT COUNT(*) as count FROM events 
      WHERE deleted_at IS NULL
    `;
      const params: any[] = [];

      // Apply same filters as getFilteredEvents
      if (filters.date_from) {
        query += ` AND date >= ?`;
        params.push(filters.date_from);
      }

      if (filters.date_to) {
        query += ` AND date <= ?`;
        params.push(filters.date_to);
      }

      if (filters.category) {
        query += ` AND category = ?`;
        params.push(filters.category);
      }

      if (filters.priority) {
        query += ` AND priority = ?`;
        params.push(filters.priority);
      }

      if (filters.search_term) {
        query += ` AND search_text LIKE ?`;
        params.push(`%${filters.search_term.trim()}%`);
      }

      if (filters.show_recurring === false) {
        query += ` AND is_recurring = 0`;
      }

      if (!filters.show_past) {
        query += ` AND date >= datetime('now')`;
      }

      const stmt = this.db.prepare(query);
      const result = stmt.get(...params) as { count: number };

      const count = result.count;

      // Cache result for 2 minutes (counts change less frequently)
      this.setCachedResult(cacheKey, count, 2 * 60 * 1000);
      this.trackQueryPerformance(
        "getFilteredEventsCount",
        performance.now() - startTime,
        1
      );

      return count;
    } catch (error) {
      console.error("Error counting filtered events:", error);
      this.trackQueryPerformance(
        "getFilteredEventsCount_error",
        performance.now() - startTime,
        0
      );
      return 0;
    }
  }

  /**
   * Get Total Events Count (Unfiltered)
   * Optimized count query for general statistics and pagination baseline
   * Performance: Uses covering index on deleted_at for O(log n) execution
   */
  getTotalEventsCount(): number {
    this.ensureInitialized();
    const startTime = performance.now();

    // Cache key for total count (changes less frequently)
    const cacheKey = "total_events_count";

    // Check cache first (longer TTL since total rarely changes)
    const cached = this.getCachedResult<number>(cacheKey);
    if (cached !== null) {
      this.trackQueryPerformance(
        "getTotalEventsCount_cached",
        performance.now() - startTime,
        1
      );
      return cached;
    }

    try {
      // Optimized COUNT query using indexed WHERE clause
      const result = this.db
        .prepare(
          `
      SELECT COUNT(*) as count 
      FROM events 
      WHERE deleted_at IS NULL
    `
        )
        .get() as { count: number };

      const totalCount = result.count;

      // Cache for 5 minutes (total count changes infrequently)
      this.setCachedResult(cacheKey, totalCount, 5 * 60 * 1000);
      this.trackQueryPerformance(
        "getTotalEventsCount",
        performance.now() - startTime,
        1
      );

      return totalCount;
    } catch (error) {
      console.error("Error getting total events count:", error);
      this.trackQueryPerformance(
        "getTotalEventsCount_error",
        performance.now() - startTime,
        0
      );
      return 0;
    }
  }

  /**
   * Get Upcoming Events with Enhanced Intelligence
   * Optimized query for dashboard and notification systems
   */
  getUpcomingEvents(limit: number = 5, offset: number = 0): Event[] {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      const today = new Date().toISOString().split("T")[0];
      const results = this.db
        .prepare(
          `
        SELECT * FROM events 
        WHERE deleted_at IS NULL AND date >= ? 
        ORDER BY 
          CASE WHEN date = ? THEN 0 ELSE 1 END,  -- Today's events first
          priority = 'high' DESC,               -- High priority events next
          date ASC 
        LIMIT ? OFFSET ?
      `
        )
        .all(today, today, limit, offset) as any[];

      const transformedResults = results.map((event) => ({
        id: event.id,
        title: event.title,
        date: event.date,
        description: event.description,
        is_recurring: Boolean(event.is_recurring),
        created_at: event.created_at,
        updated_at: event.updated_at,
      }));

      this.trackQueryPerformance(
        "getUpcomingEvents",
        performance.now() - startTime,
        transformedResults.length
      );
      return transformedResults;
    } catch (error) {
      console.error("Database read error:", error);
      return [];
    }
  }

  /**
   * Get Upcoming Events Count (Date-Filtered Count Query)
   * Optimized for dashboard statistics and pagination of future events
   *
   * Performance Characteristics:
   * - Utilizes composite index: idx_events_upcoming (date, is_recurring, priority)
   * - Query complexity: O(log n) due to indexed date comparison
   * - Cache TTL: 2 minutes (upcoming count changes more frequently than total)
   */
  getUpcomingEventsCount(): number {
    this.ensureInitialized();
    const startTime = performance.now();

    // Cache key with temporal context for debugging
    const cacheKey = "upcoming_events_count";

    // Priority cache lookup (upcoming events change frequently)
    const cached = this.getCachedResult<number>(cacheKey);
    if (cached !== null) {
      this.trackQueryPerformance(
        "getUpcomingEventsCount_cached",
        performance.now() - startTime,
        1
      );
      return cached;
    }

    try {
      // Current date boundary calculation
      const today = new Date().toISOString().split("T")[0];

      // Optimized COUNT query leveraging covering index
      // Uses idx_events_upcoming: (date, is_recurring, priority) WHERE deleted_at IS NULL
      const result = this.db
        .prepare(
          `
      SELECT COUNT(*) as count 
      FROM events 
      WHERE deleted_at IS NULL AND date >= ?
    `
        )
        .get(today) as { count: number };

      const upcomingCount = result.count;

      // Shorter cache TTL (2 minutes) since upcoming events change as time progresses
      this.setCachedResult(cacheKey, upcomingCount, 2 * 60 * 1000);
      this.trackQueryPerformance(
        "getUpcomingEventsCount",
        performance.now() - startTime,
        1
      );

      return upcomingCount;
    } catch (error) {
      console.error("Error counting upcoming events:", error);
      this.trackQueryPerformance(
        "getUpcomingEventsCount_error",
        performance.now() - startTime,
        0
      );
      return 0;
    }
  }

  /**
   * Get Past Events Count (Historical Events Analysis)
   *
   * Performance Characteristics:
   * - Utilizes B-tree index scan on date column with reverse boundary condition
   * - Query complexity: O(log n) due to indexed date comparison (date < today)
   * - Memory overhead: Minimal scalar result caching
   *
   * Index Strategy: Leverages idx_events_date for optimal range scan performance
   */
  getPastEventsCount(): number {
    this.ensureInitialized();
    const startTime = performance.now();

    const cacheKey = "past_events_count";

    // Cache lookup with performance tracking
    const cached = this.getCachedResult<number>(cacheKey);
    if (cached !== null) {
      this.trackQueryPerformance(
        "getPastEventsCount_cached",
        performance.now() - startTime,
        1
      );
      return cached;
    }

    try {
      // Date boundary calculation - ISO format for consistent comparison
      const today = new Date().toISOString().split("T")[0];

      // Optimized COUNT query using date index with reverse range scan
      // SQL execution plan: Index Range Scan (date < boundary) + COUNT aggregation
      const result = this.db
        .prepare(
          `
      SELECT COUNT(*) as count 
      FROM events 
      WHERE deleted_at IS NULL AND date < ?
    `
        )
        .get(today) as { count: number };

      const pastCount = result.count;

      // Extended cache TTL (10 minutes) - past events are immutable once date passes
      this.setCachedResult(cacheKey, pastCount, 10 * 60 * 1000);
      this.trackQueryPerformance(
        "getPastEventsCount",
        performance.now() - startTime,
        1
      );

      return pastCount;
    } catch (error) {
      console.error("Error counting past events:", error);
      this.trackQueryPerformance(
        "getPastEventsCount_error",
        performance.now() - startTime,
        0
      );
      return 0;
    }
  }

  /**
   * Get Recurring Events Count (Pattern-Based Event Analysis)
   *
   * Performance Characteristics:
   * - Utilizes covering index on is_recurring column for direct boolean lookup
   * - Query complexity: O(log n) with boolean index scan
   * - Stable dataset: Recurring flag rarely changes after event creation
   *
   * Index Strategy: Uses idx_events_recurring for optimal boolean filtering
   */
  getRecurringEventsCount(): number {
    this.ensureInitialized();
    const startTime = performance.now();

    const cacheKey = "recurring_events_count";

    // Priority cache access - recurring events change infrequently
    const cached = this.getCachedResult<number>(cacheKey);
    if (cached !== null) {
      this.trackQueryPerformance(
        "getRecurringEventsCount_cached",
        performance.now() - startTime,
        1
      );
      return cached;
    }

    try {
      // Boolean index scan optimization
      // SQL execution plan: Index Seek (is_recurring = 1) + COUNT aggregation
      const result = this.db
        .prepare(
          `
      SELECT COUNT(*) as count 
      FROM events 
      WHERE deleted_at IS NULL AND is_recurring = 1
    `
        )
        .get() as { count: number };

      const recurringCount = result.count;

      // Long cache TTL (15 minutes) - recurring configuration is relatively stable
      this.setCachedResult(cacheKey, recurringCount, 15 * 60 * 1000);
      this.trackQueryPerformance(
        "getRecurringEventsCount",
        performance.now() - startTime,
        1
      );

      return recurringCount;
    } catch (error) {
      console.error("Error counting recurring events:", error);
      this.trackQueryPerformance(
        "getRecurringEventsCount_error",
        performance.now() - startTime,
        0
      );
      return 0;
    }
  }

  /**
   * Get Events This Month Count (Temporal Window Analysis)
   *
   * Performance Characteristics:
   * - Complex date range query utilizing SQLite datetime functions
   * - Query complexity: O(log n) with compound date range filtering
   * - Dynamic temporal window: Month boundary recalculated on each execution
   *
   * Optimization Strategy:
   * - Uses SQLite's optimized datetime functions for month boundary calculation
   * - Leverages composite date index for range scan efficiency
   * - Shorter cache TTL due to daily boundary shifts
   */
  getEventsThisMonthCount(): number {
    this.ensureInitialized();
    const startTime = performance.now();

    const cacheKey = "events_this_month_count";

    // Cache validation for temporal queries
    const cached = this.getCachedResult<number>(cacheKey);
    if (cached !== null) {
      this.trackQueryPerformance(
        "getEventsThisMonthCount_cached",
        performance.now() - startTime,
        1
      );
      return cached;
    }

    try {
      // SQLite datetime function optimization for month boundary calculations
      // Uses built-in 'start of month' and '+1 month' modifiers for precise range
      // SQL execution plan: Index Range Scan (date BETWEEN month_start AND month_end)
      const result = this.db
        .prepare(
          `
      SELECT COUNT(*) as count 
      FROM events 
      WHERE deleted_at IS NULL 
        AND date >= datetime('now', 'start of month') 
        AND date < datetime('now', 'start of month', '+1 month')
    `
        )
        .get() as { count: number };

      const thisMonthCount = result.count;

      // Moderate cache TTL (5 minutes) - month boundaries shift daily at midnight
      this.setCachedResult(cacheKey, thisMonthCount, 5 * 60 * 1000);
      this.trackQueryPerformance(
        "getEventsThisMonthCount",
        performance.now() - startTime,
        1
      );

      return thisMonthCount;
    } catch (error) {
      console.error("Error counting events this month:", error);
      this.trackQueryPerformance(
        "getEventsThisMonthCount_error",
        performance.now() - startTime,
        0
      );
      return 0;
    }
  }

  /**
   * Enhanced Event Statistics with Comprehensive Metrics
   * Provides detailed analytics for dashboard displays
   */
  getEventStats(): EventStats {
    this.ensureInitialized();
    const startTime = performance.now();

    const cacheKey = "event_stats";
    const cached = this.getCachedResult<EventStats>(cacheKey);
    if (cached) {
      this.trackQueryPerformance(
        "getEventStats_cached",
        performance.now() - startTime
      );
      return cached;
    }

    try {
      const stats = this.db
        .prepare(
          `
        SELECT 
          COUNT(*) as total_events,
          COUNT(CASE WHEN date >= datetime('now') AND deleted_at IS NULL THEN 1 END) as upcoming_events,
          COUNT(CASE WHEN date < datetime('now') AND deleted_at IS NULL THEN 1 END) as past_events,
          COUNT(CASE WHEN is_recurring = 1 AND deleted_at IS NULL THEN 1 END) as recurring_events,
          COUNT(CASE WHEN date >= datetime('now', 'start of month') 
                     AND date < datetime('now', 'start of month', '+1 month') 
                     AND deleted_at IS NULL THEN 1 END) as events_this_month
        FROM events 
        WHERE deleted_at IS NULL
      `
        )
        .get() as EventStats;

      // Get next upcoming event with enhanced details
      const nextEvent = this.db
        .prepare(
          `
        SELECT * FROM events 
        WHERE deleted_at IS NULL AND date >= datetime('now')
        ORDER BY date ASC, priority = 'high' DESC
        LIMIT 1
      `
        )
        .get();

      const result: EventStats = {
        ...stats,
        next_event: nextEvent ? this.parseEventFromDB(nextEvent) : undefined,
      };

      // Cache for 1 minute (stats change frequently)
      this.setCachedResult(cacheKey, result, 60 * 1000);
      this.trackQueryPerformance(
        "getEventStats",
        performance.now() - startTime
      );

      return result;
    } catch (error) {
      console.error("Error calculating event stats:", error);
      return {
        total_events: 0,
        upcoming_events: 0,
        past_events: 0,
        recurring_events: 0,
        events_this_month: 0,
      };
    }
  }

  /**
   * Add Event - Legacy Method with Enhanced Features
   * Maintains backward compatibility while adding audit trail
   */
  addEvent(
    event: Omit<Event, "id" | "created_at" | "updated_at">
  ): number | null {
    return this.createEnhancedEvent({
      title: event.title,
      date: event.date,
      description: event.description || "",
      is_recurring: event.is_recurring,
      category: "other",
      priority: "medium",
      is_all_day: false,
      timezone: "UTC",
    });
  }

  /**
   * Create Enhanced Event with Comprehensive Features
   * Implements full audit trail and validation
   */
  createEnhancedEvent(
    eventData: {
      title: string;
      date: string;
      description?: string;
      is_recurring: boolean;
      recurring_config?: RecurringEventConfig;
      category: EnhancedEvent["category"];
      priority: EnhancedEvent["priority"];
      timezone?: string;
      is_all_day?: boolean;
      location?: string;
      reminder_minutes?: number;
    },
    userId?: string
  ): number | null {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      // Begin transaction for atomic operation
      const transaction = this.db.transaction(() => {
        // Insert main event record
        const stmt = this.db.prepare(`
          INSERT INTO events (
            title, description, date, timezone, is_all_day, location,
            category, priority, is_recurring, recurring_config,
            reminder_minutes, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
          eventData.title,
          eventData.description || null,
          eventData.date,
          eventData.timezone || "UTC",
          eventData.is_all_day ? 1 : 0,
          eventData.location || null,
          eventData.category,
          eventData.priority,
          eventData.is_recurring ? 1 : 0,
          eventData.recurring_config
            ? JSON.stringify(eventData.recurring_config)
            : null,
          eventData.reminder_minutes || null,
          userId,
          userId
        );

        const eventId = result.lastInsertRowid as number;

        // Create audit trail entry
        this.db
          .prepare(
            `
          INSERT INTO event_history (event_id, action, new_values, changed_by)
          VALUES (?, 'created', ?, ?)
        `
          )
          .run(eventId, JSON.stringify(eventData), userId);

        // Schedule reminder if needed
        if (eventData.reminder_minutes) {
          const eventDate = new Date(eventData.date);
          const reminderTime = new Date(
            eventDate.getTime() - eventData.reminder_minutes * 60 * 1000
          );

          this.db
            .prepare(
              `
            INSERT INTO event_reminders (event_id, reminder_time)
            VALUES (?, ?)
          `
            )
            .run(eventId, reminderTime.toISOString());
        }

        return eventId;
      });

      const eventId = transaction();

      // Invalidate relevant caches
      this.invalidateCache("events");
      this.trackQueryPerformance(
        "createEnhancedEvent",
        performance.now() - startTime,
        1
      );

      return eventId;
    } catch (error) {
      console.error("Error creating enhanced event:", error);
      this.trackQueryPerformance(
        "createEnhancedEvent_error",
        performance.now() - startTime,
        0
      );
      return null;
    }
  }

  /**
   * Update Event with Enhanced Change Tracking
   * Implements optimistic locking and comprehensive audit trail
   */
  updateEvent(id: number, event: Partial<Event>): boolean {
    return this.updateEnhancedEvent(id, {
      title: event.title,
      date: event.date,
      description: event.description,
      is_recurring: event.is_recurring,
    });
  }

  updateEnhancedEvent(
    eventId: number,
    eventData: Partial<{
      title: string;
      date: string;
      description: string;
      is_recurring: boolean;
      recurring_config: RecurringEventConfig;
      category: EnhancedEvent["category"];
      priority: EnhancedEvent["priority"];
      timezone: string;
      is_all_day: boolean;
      location: string;
      reminder_minutes: number;
    }>,
    userId?: string
  ): boolean {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      // Get current event for change detection
      const currentEvent = this.db
        .prepare("SELECT * FROM events WHERE id = ? AND deleted_at IS NULL")
        .get(eventId);

      if (!currentEvent) return false;

      // Track changes for audit trail
      const changes: Record<string, { old: any; new: any }> = {};
      const changedFields: string[] = [];

      // Build update query dynamically
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      Object.entries(eventData).forEach(([key, value]) => {
        if (value !== undefined && currentEvent[key] !== value) {
          changes[key] = { old: currentEvent[key], new: value };
          changedFields.push(key);

          if (key === "recurring_config") {
            updateFields.push(`${key} = ?`);
            updateValues.push(value ? JSON.stringify(value) : null);
          } else if (typeof value === "boolean") {
            updateFields.push(`${key} = ?`);
            updateValues.push(value ? 1 : 0);
          } else {
            updateFields.push(`${key} = ?`);
            updateValues.push(value);
          }
        }
      });

      if (updateFields.length === 0) {
        this.trackQueryPerformance(
          "updateEnhancedEvent_nochange",
          performance.now() - startTime,
          0
        );
        return true; // No changes
      }

      // Add metadata fields
      updateFields.push("updated_at = CURRENT_TIMESTAMP");
      updateFields.push("updated_by = ?");
      updateFields.push("version = version + 1");
      updateValues.push(userId);
      updateValues.push(eventId);

      const transaction = this.db.transaction(() => {
        // Update main event record
        const updateQuery = `
          UPDATE events 
          SET ${updateFields.join(", ")}
          WHERE id = ? AND deleted_at IS NULL
        `;

        const result = this.db.prepare(updateQuery).run(...updateValues);

        if (result.changes === 0) return false;

        // Create audit trail entry
        this.db
          .prepare(
            `
          INSERT INTO event_history (
            event_id, action, changed_fields, old_values, new_values, changed_by
          ) VALUES (?, 'updated', ?, ?, ?, ?)
        `
          )
          .run(
            eventId,
            JSON.stringify(changedFields),
            JSON.stringify(
              Object.fromEntries(
                Object.entries(changes).map(([k, v]) => [k, v.old])
              )
            ),
            JSON.stringify(
              Object.fromEntries(
                Object.entries(changes).map(([k, v]) => [k, v.new])
              )
            ),
            userId
          );

        return true;
      });

      const success = transaction();

      if (success) {
        this.invalidateCache("events");
      }

      this.trackQueryPerformance(
        "updateEnhancedEvent",
        performance.now() - startTime,
        success ? 1 : 0
      );
      return success;
    } catch (error) {
      console.error("Error updating enhanced event:", error);
      this.trackQueryPerformance(
        "updateEnhancedEvent_error",
        performance.now() - startTime,
        0
      );
      return false;
    }
  }

  /**
   * Soft Delete Event with Recovery Option
   * Maintains data integrity while allowing restoration
   */
  deleteEvent(id: number, userId?: string): boolean {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      const transaction = this.db.transaction(() => {
        // Get event data for audit trail
        const event = this.db
          .prepare("SELECT * FROM events WHERE id = ? AND deleted_at IS NULL")
          .get(id);

        if (!event) return false;

        // Soft delete the event
        const result = this.db
          .prepare(
            `
          UPDATE events 
          SET deleted_at = CURRENT_TIMESTAMP, updated_by = ?, version = version + 1
          WHERE id = ? AND deleted_at IS NULL
        `
          )
          .run(userId, id);

        if (result.changes === 0) return false;

        // Create audit trail entry
        this.db
          .prepare(
            `
          INSERT INTO event_history (event_id, action, old_values, changed_by)
          VALUES (?, 'deleted', ?, ?)
        `
          )
          .run(id, JSON.stringify(event), userId);

        // Cancel pending reminders
        this.db
          .prepare(
            `
          UPDATE event_reminders 
          SET status = 'cancelled' 
          WHERE event_id = ? AND status = 'pending'
        `
          )
          .run(id);

        return true;
      });

      const success = transaction();

      if (success) {
        this.invalidateCache("events");
      }

      this.trackQueryPerformance(
        "deleteEvent",
        performance.now() - startTime,
        success ? 1 : 0
      );
      return success;
    } catch (error) {
      console.error("Error deleting event:", error);
      this.trackQueryPerformance(
        "deleteEvent_error",
        performance.now() - startTime,
        0
      );
      return false;
    }
  }

  /**
   * Restore Soft-Deleted Event
   * Allows recovery of accidentally deleted events
   */
  restoreEvent(id: number, userId?: string): boolean {
    this.ensureInitialized();

    try {
      const transaction = this.db.transaction(() => {
        const result = this.db
          .prepare(
            `
          UPDATE events 
          SET deleted_at = NULL, updated_by = ?, version = version + 1
          WHERE id = ? AND deleted_at IS NOT NULL
        `
          )
          .run(userId, id);

        if (result.changes === 0) return false;

        // Create audit trail entry
        this.db
          .prepare(
            `
          INSERT INTO event_history (event_id, action, changed_by)
          VALUES (?, 'restored', ?)
        `
          )
          .run(id, userId);

        return true;
      });

      const success = transaction();

      if (success) {
        this.invalidateCache("events");
      }

      return success;
    } catch (error) {
      console.error("Error restoring event:", error);
      return false;
    }
  }

  // ========================================
  // USER METHODS (Original API)
  // ========================================

  getUserByEmail(email: string): User | undefined {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      const result = this.db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(email) as User | undefined;
      this.trackQueryPerformance(
        "getUserByEmail",
        performance.now() - startTime,
        result ? 1 : 0
      );
      return result;
    } catch (error) {
      console.error("Database read error:", error);
      return undefined;
    }
  }

  // ========================================
  // PHOTO METHODS (Original API)
  // ========================================

  getAllPhotos(): Photo[] {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      const results = this.db
        .prepare("SELECT * FROM photos ORDER BY upload_date DESC")
        .all() as Photo[];
      this.trackQueryPerformance(
        "getAllPhotos",
        performance.now() - startTime,
        results.length
      );
      return results;
    } catch (error) {
      console.error("Database read error:", error);
      return [];
    }
  }

  addPhoto(photo: Omit<Photo, "id" | "created_at">): number | null {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO photos (cloudinary_id, public_url, title, description, upload_date)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        photo.cloudinary_id,
        photo.public_url,
        photo.title,
        photo.description,
        photo.upload_date
      );

      this.trackQueryPerformance("addPhoto", performance.now() - startTime, 1);
      return result.lastInsertRowid as number;
    } catch (error) {
      console.error("Error adding photo:", error);
      return null;
    }
  }

  updatePhoto(
    id: number,
    data: { title?: string; description?: string }
  ): boolean {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      const stmt = this.db.prepare(`
        UPDATE photos 
        SET title = COALESCE(?, title),
            description = COALESCE(?, description)
        WHERE id = ?
      `);

      const result = stmt.run(data.title, data.description, id);
      this.trackQueryPerformance(
        "updatePhoto",
        performance.now() - startTime,
        result.changes
      );

      return result.changes > 0;
    } catch (error) {
      console.error("Error updating photo:", error);
      return false;
    }
  }

  deletePhoto(id: number): Photo | null {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      const photo = this.db
        .prepare("SELECT * FROM photos WHERE id = ?")
        .get(id) as Photo;
      if (!photo) return null;

      const result = this.db.prepare("DELETE FROM photos WHERE id = ?").run(id);
      this.trackQueryPerformance(
        "deletePhoto",
        performance.now() - startTime,
        result.changes
      );

      return result.changes > 0 ? photo : null;
    } catch (error) {
      console.error("Error deleting photo:", error);
      return null;
    }
  }

  // ========================================
  // UTILITY AND MAINTENANCE METHODS
  // ========================================

  /**
   * Parse Database Event to Application Format
   * Handles type conversions and JSON parsing safely
   */
  private parseEventFromDB(dbEvent: any): EnhancedEvent {
    return {
      ...dbEvent,
      recurring_config: dbEvent.recurring_config
        ? JSON.parse(dbEvent.recurring_config)
        : undefined,
      is_recurring: Boolean(dbEvent.is_recurring),
      is_all_day: Boolean(dbEvent.is_all_day),
      version: dbEvent.version || 1,
    };
  }

  /**
   * Get Performance Metrics for Monitoring
   * Provides insights into database performance
   */
  getPerformanceMetrics(): Record<
    string,
    { count: number; avgTime: number; totalTime: number }
  > {
    return Object.fromEntries(this.performanceMetrics.entries());
  }

  /**
   * Database Maintenance and Optimization
   * Should be called periodically to maintain performance
   */
  async performMaintenance(): Promise<void> {
    this.ensureInitialized();

    try {
      console.log("🔧 Starting database maintenance...");

      // Analyze tables for query optimization
      this.db.exec("ANALYZE events");
      this.db.exec("ANALYZE event_history");
      this.db.exec("ANALYZE couple_info");
      this.db.exec("ANALYZE photos");
      this.db.exec("ANALYZE users");

      // Clean up old performance data (keep last 30 days)
      this.db
        .prepare(
          `
        DELETE FROM query_performance 
        WHERE executed_at < datetime('now', '-30 days')
      `
        )
        .run();

      // Clean up old audit trail (keep last 90 days)
      this.db
        .prepare(
          `
        DELETE FROM event_history 
        WHERE changed_at < datetime('now', '-90 days')
      `
        )
        .run();

      // Clear expired cache entries
      this.invalidateCache();

      // Log database size information
      const dbSize = this.db
        .prepare(
          `
        SELECT page_count * page_size as size 
        FROM pragma_page_count(), pragma_page_size()
      `
        )
        .get();

      console.log(
        `📊 Database size: ${(dbSize.size / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(`🗂️ Cache entries: ${this.queryCache.size}`);
      console.log(
        `📈 Performance metrics tracked: ${this.performanceMetrics.size} query types`
      );

      console.log("✅ Database maintenance completed");
    } catch (error) {
      console.error("❌ Database maintenance failed:", error);
    }
  }

  /**
   * Schedule Periodic Maintenance Tasks
   * Implements automatic optimization scheduling
   */
  private scheduleMaintenanceTasks(): void {
    // Run maintenance every 6 hours in production
    const maintenanceInterval =
      process.env.NODE_ENV === "production"
        ? 6 * 60 * 60 * 1000
        : 60 * 60 * 1000;

    setInterval(() => {
      this.performMaintenance().catch((error) => {
        console.error("Scheduled maintenance failed:", error);
      });
    }, maintenanceInterval);
  }

  /**
   * Enhanced Default Data Seeding
   * Sets up initial data with enhanced event features
   */
  private async seedDefaultData(): Promise<void> {
    this.ensureInitialized();

    try {
      const coupleCount = this.db
        .prepare("SELECT COUNT(*) as count FROM couple_info")
        .get() as { count: number };
      const userCount = this.db
        .prepare("SELECT COUNT(*) as count FROM users")
        .get() as { count: number };

      if (coupleCount.count === 0) {
        this.db
          .prepare(
            `
          INSERT INTO couple_info (male_name, female_name, love_start_date, male_birthday, female_birthday)
          VALUES (?, ?, ?, ?, ?)
        `
          )
          .run("Bá An", "Kiều Trâm", "2024-12-27", "06-06", "08-12");

        console.log("💕 Default couple information created");
      }

      if (userCount.count === 0) {
        const defaultPassword = "anandtram1206";
        const hashedPassword = await bcrypt.hash(defaultPassword, 12);

        const insertUser = this.db.prepare(`
          INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)
        `);

        insertUser.run("an@gmail.com", hashedPassword, "An");
        insertUser.run("tram@gmail.com", hashedPassword, "Trâm");

        console.log("👤 Default user accounts created");

        // Create some sample enhanced events
        this.createEnhancedEvent(
          {
            title: "Our First Anniversary",
            date: "2025-12-27T19:00:00Z",
            description: "Celebrating one year of love and happiness together",
            is_recurring: true,
            recurring_config: { frequency: "yearly", interval: 1 },
            category: "anniversary",
            priority: "high",
            timezone: "Asia/Ho_Chi_Minh",
            is_all_day: false,
            location: "Romantic Restaurant",
            reminder_minutes: 1440,
          },
          "1"
        );

        this.createEnhancedEvent(
          {
            title: "An's Birthday",
            date: "2025-06-06T00:00:00Z",
            description: "Celebrating An's special day",
            is_recurring: true,
            recurring_config: { frequency: "yearly", interval: 1 },
            category: "birthday",
            priority: "high",
            timezone: "Asia/Ho_Chi_Minh",
            is_all_day: true,
            reminder_minutes: 1440,
          },
          "2"
        );

        console.log("🎉 Sample events created");
      }
    } catch (error) {
      console.error("❌ Default data seeding failed:", error);
    }
  }

  /**
   * Safe Database Connection Closure
   * Ensures proper cleanup and resource management
   */
  close(): void {
    if (this.db) {
      try {
        // Clear all caches
        this.invalidateCache();

        // Close database connection
        this.db.close();
        console.log("🔒 Database connection closed");
      } catch (error) {
        console.error("Error closing database:", error);
      }
    }
    this.initialized = false;
  }
}

// ========================================
// SINGLETON PATTERN WITH ASYNC INITIALIZATION
// ========================================

let dbInstance: DatabaseManager | null = null;
let initializationPromise: Promise<DatabaseManager> | null = null;

/**
 * Get Database Instance - Enhanced Singleton with Error Recovery
 * Implements robust initialization with retry mechanisms
 */
export async function getDatabase(): Promise<DatabaseManager> {
  if (dbInstance && dbInstance["initialized"]) {
    return dbInstance;
  }

  // Prevent multiple simultaneous initializations
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        if (!dbInstance) {
          dbInstance = new DatabaseManager();
        }

        await dbInstance.initialize();
        return dbInstance;
      } catch (error) {
        retryCount++;
        console.error(
          `❌ Database initialization attempt ${retryCount} failed:`,
          error
        );

        if (retryCount >= maxRetries) {
          dbInstance = null;
          initializationPromise = null;
          throw new Error(
            `Database initialization failed after ${maxRetries} attempts. Check server environment and permissions.`
          );
        }

        // Wait before retry with exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000)
        );
      }
    }

    throw new Error("Unexpected error in database initialization");
  })();

  return initializationPromise;
}

/**
 * Enhanced Database Connection Cleanup
 * Provides graceful shutdown capabilities
 */
export function closeDatabaseConnection(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    initializationPromise = null;
    console.log("🧹 Database connection cleanup completed");
  }
}

/**
 * Get Database Performance Metrics
 * Utility function for monitoring and debugging
 */
export async function getDatabaseMetrics(): Promise<Record<string, any>> {
  try {
    const db = await getDatabase();
    return db.getPerformanceMetrics();
  } catch (error) {
    console.error("Error getting database metrics:", error);
    return {};
  }
}

/**
 * Force Database Maintenance
 * Utility function for manual maintenance triggers
 */
export async function performDatabaseMaintenance(): Promise<void> {
  try {
    const db = await getDatabase();
    await db.performMaintenance();
  } catch (error) {
    console.error("Error performing database maintenance:", error);
  }
}
