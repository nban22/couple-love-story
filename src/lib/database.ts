// lib/database.ts - Enhanced PostgreSQL database with comprehensive event management
import { Pool, PoolClient } from 'pg';
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
 * PostgreSQL Connection Pool Configuration
 * Optimized for production workloads with automatic connection management
 */
const createConnectionPool = () => {
  if (!isServerEnvironment()) {
    throw new Error("Database connections are server-side only");
  }

  const connectionConfig = {
    connectionString: process.env.DATABASE_URL,
    // Production optimization settings
    max: 20, // Maximum connections in pool
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 2000, // Timeout after 2s
    // SSL configuration for production
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    // Connection retry and error handling
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    // Query timeout settings
    statement_timeout: 30000, // 30 second query timeout
    query_timeout: 30000,
  };

  return new Pool(connectionConfig);
};

let pool: Pool | null = null;

/**
 * Get or create PostgreSQL connection pool
 * Implements singleton pattern with proper error handling
 */
function getConnectionPool(): Pool {
  if (!pool) {
    pool = createConnectionPool();
    
    // Handle pool events for monitoring and debugging
    pool.on('connect', () => {
      console.log('🔗 PostgreSQL client connected to pool');
    });
    
    pool.on('error', (err) => {
      console.error('❌ PostgreSQL pool error:', err);
    });

    pool.on('remove', () => {
      console.log('🔌 PostgreSQL client removed from pool');
    });
  }
  
  return pool;
}

/**
 * Enhanced DatabaseManager with Production-Grade PostgreSQL Features
 * Implements comprehensive event management, caching, and monitoring
 */
class DatabaseManager {
  private pool: Pool;
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

  constructor() {
    if (!isServerEnvironment()) {
      throw new Error("Database can only be initialized on server");
    }
    this.pool = getConnectionPool();
  }

  /**
   * Async Initialization with Enhanced Error Handling
   * Implements connection testing and schema management
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Test database connection
      const client = await this.pool.connect();
      console.log(`✅ PostgreSQL connection established`);
      
      // Initialize schema and seed data
      await this.initializeEnhancedTables(client);
      await this.createOptimizedIndexes(client);
      await this.runSchemaMigrations(client);
      await this.seedDefaultData(client);
      
      client.release();
      this.initialized = true;
      
      // Schedule periodic maintenance
      this.scheduleMaintenanceTasks();
      
      console.log('✅ PostgreSQL database initialized successfully');
    } catch (error) {
      this.initialized = false;
      console.error("❌ Database initialization failed:", error);
      throw new Error(
        `Database initialization failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Enhanced Table Creation with Comprehensive PostgreSQL Schema
   * Implements proper normalization and constraint management
   */
  private async initializeEnhancedTables(client: PoolClient): Promise<void> {
    try {
      const createTablesSQL = `
        -- Enable UUID extension for better primary keys (optional)
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        -- Original tables (maintained for backward compatibility)
        CREATE TABLE IF NOT EXISTS couple_info (
          id SERIAL PRIMARY KEY,
          male_name VARCHAR(100) NOT NULL,
          female_name VARCHAR(100) NOT NULL,
          love_start_date DATE NOT NULL,
          male_birthday VARCHAR(5) NOT NULL, -- MM-DD format
          female_birthday VARCHAR(5) NOT NULL, -- MM-DD format
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(100) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS photos (
          id SERIAL PRIMARY KEY,
          cloudinary_id VARCHAR(255) UNIQUE NOT NULL,
          public_url TEXT NOT NULL,
          title VARCHAR(200),
          description TEXT,
          upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Enhanced events table with comprehensive PostgreSQL features
        CREATE TABLE IF NOT EXISTS events (
          id SERIAL PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          description TEXT,
          date TIMESTAMP WITH TIME ZONE NOT NULL,
          timezone VARCHAR(50) DEFAULT 'UTC',
          is_all_day BOOLEAN DEFAULT FALSE,
          location VARCHAR(300),
          
          -- Categorization with CHECK constraints
          category VARCHAR(20) DEFAULT 'other' 
            CHECK (category IN ('anniversary', 'birthday', 'date', 'milestone', 'other')),
          priority VARCHAR(10) DEFAULT 'medium'
            CHECK (priority IN ('low', 'medium', 'high')),
          
          -- Recurring configuration as JSONB for better performance
          is_recurring BOOLEAN DEFAULT FALSE,
          recurring_config JSONB,
          
          -- Reminder settings
          reminder_minutes INTEGER,
          
          -- Audit trail
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(50),
          updated_by VARCHAR(50),
          version INTEGER DEFAULT 1,
          
          -- Soft delete
          deleted_at TIMESTAMP WITH TIME ZONE,
          
          -- Full-text search using PostgreSQL's tsvector
          search_vector tsvector GENERATED ALWAYS AS (
            to_tsvector('english', 
              title || ' ' || COALESCE(description, '') || ' ' || COALESCE(location, '')
            )
          ) STORED
        );

        -- Event history for comprehensive audit trail
        CREATE TABLE IF NOT EXISTS event_history (
          id SERIAL PRIMARY KEY,
          event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'restored')),
          changed_fields JSONB,
          old_values JSONB,
          new_values JSONB,
          changed_by VARCHAR(50),
          changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Event reminders and notifications
        CREATE TABLE IF NOT EXISTS event_reminders (
          id SERIAL PRIMARY KEY,
          event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
          reminder_type VARCHAR(20) DEFAULT 'standard' 
            CHECK (reminder_type IN ('standard', 'urgent', 'gentle')),
          status VARCHAR(20) DEFAULT 'pending' 
            CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
          delivery_method VARCHAR(20) DEFAULT 'browser' 
            CHECK (delivery_method IN ('browser', 'email', 'push')),
          retry_count INTEGER DEFAULT 0,
          last_attempt TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Schema migrations tracking
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          description TEXT,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Query performance monitoring
        CREATE TABLE IF NOT EXISTS query_performance (
          id SERIAL PRIMARY KEY,
          query_type VARCHAR(100) NOT NULL,
          execution_time_ms REAL NOT NULL,
          result_count INTEGER,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create updated_at trigger function
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';

        -- Apply trigger to tables that need auto-updated timestamps
        DROP TRIGGER IF EXISTS update_couple_info_updated_at ON couple_info;
        CREATE TRIGGER update_couple_info_updated_at 
          BEFORE UPDATE ON couple_info 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS update_events_updated_at ON events;
        CREATE TRIGGER update_events_updated_at 
          BEFORE UPDATE ON events 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `;

      await client.query(createTablesSQL);
      console.log("📋 PostgreSQL tables initialized successfully");
    } catch (error) {
      console.error("❌ Table initialization failed:", error);
      throw error;
    }
  }

  /**
   * Strategic Index Creation for Optimal PostgreSQL Query Performance
   * Implements covering indexes and composite indexes for common access patterns
   */
  private async createOptimizedIndexes(client: PoolClient): Promise<void> {
    try {
      const indexSQL = `
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
                WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(created_by, date) WHERE deleted_at IS NULL;
        
        -- Full-text search index using GIN
        CREATE INDEX IF NOT EXISTS idx_events_search_vector ON events USING gin(search_vector);
        
        -- Foreign key indexes for better join performance
        CREATE INDEX IF NOT EXISTS idx_event_history_event_id ON event_history(event_id);
        CREATE INDEX IF NOT EXISTS idx_event_history_changed_at ON event_history(changed_at);
        CREATE INDEX IF NOT EXISTS idx_event_reminders_event_id ON event_reminders(event_id);
        CREATE INDEX IF NOT EXISTS idx_event_reminders_time_status ON event_reminders(reminder_time, status);
        
        -- Original table indexes (maintained)
        CREATE INDEX IF NOT EXISTS idx_photos_upload_date ON photos(upload_date);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_photos_cloudinary_id ON photos(cloudinary_id);
        
        -- Performance monitoring indexes
        CREATE INDEX IF NOT EXISTS idx_query_perf_type_time ON query_performance(query_type, executed_at);
      `;

      await client.query(indexSQL);
      console.log("🚀 PostgreSQL indexes created for optimal performance");
    } catch (error) {
      console.error("❌ Index creation failed:", error);
      throw error;
    }
  }

  /**
   * Schema Migration System for Database Evolution
   * Handles version upgrades and data transformations safely
   */
  private async runSchemaMigrations(client: PoolClient): Promise<void> {
    const migrations = [
      {
        version: 1,
        description: "Initial PostgreSQL schema setup",
        sql: `
          -- Migration marker - PostgreSQL schema is now active
          INSERT INTO schema_migrations (version, description) 
          VALUES (1, 'Enhanced event system with PostgreSQL, categories, priorities, and audit trail')
          ON CONFLICT (version) DO NOTHING;
        `,
      },
      {
        version: 2,
        description: "Add full-text search optimization",
        sql: `
          -- Ensure search_vector column is properly populated
          -- This is handled by the GENERATED ALWAYS AS clause
          INSERT INTO schema_migrations (version, description) 
          VALUES (2, 'Full-text search vector optimization')
          ON CONFLICT (version) DO NOTHING;
        `,
      },
    ];

    for (const migration of migrations) {
      try {
        const result = await client.query(
          "SELECT 1 FROM schema_migrations WHERE version = $1",
          [migration.version]
        );

        if (result.rows.length === 0) {
          console.log(
            `🔄 Running migration v${migration.version}: ${migration.description}`
          );
          await client.query(migration.sql);
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
    if (!this.initialized || !this.pool) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
  }

  /**
   * Execute Query with Performance Tracking and Error Handling
   * Centralized query execution with comprehensive monitoring
   */
  private async executeQuery<T = any>(
    query: string,
    params: any[] = [],
    queryType: string
  ): Promise<{ rows: T[]; rowCount: number }> {
    this.ensureInitialized();
    const startTime = performance.now();
    
    try {
      const result = await this.pool.query(query, params);
      const executionTime = performance.now() - startTime;
      
      // Track performance metrics
      this.trackQueryPerformance(queryType, executionTime, result.rowCount || 0);
      
      // Log slow queries for optimization
      if (executionTime > 100) {
        console.warn(
          `🐌 Slow query detected: ${queryType} took ${executionTime.toFixed(2)}ms`
        );
      }
      
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      console.error(`❌ Query failed (${executionTime.toFixed(2)}ms): ${queryType}`, error);
      this.trackQueryPerformance(`${queryType}_error`, executionTime, 0);
      throw error;
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

      // Periodically store performance data (10% sampling rate)
      if (Math.random() < 0.1) {
        this.executeQuery(
          `INSERT INTO query_performance (query_type, execution_time_ms, result_count)
           VALUES ($1, $2, $3)`,
          [queryType, executionTime, resultCount || 0],
          'performance_tracking'
        ).catch(error => {
          // Don't let performance tracking break main functionality
          console.warn("Performance tracking error:", error);
        });
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
  // COUPLE INFO METHODS (Original API - Now Async)
  // ========================================

  async getCoupleInfo(): Promise<CoupleInfo | undefined> {
    try {
      const result = await this.executeQuery<CoupleInfo>(
        "SELECT * FROM couple_info ORDER BY id LIMIT 1",
        [],
        "getCoupleInfo"
      );
      return result.rows[0];
    } catch (error) {
      console.error("Database read error:", error);
      return undefined;
    }
  }

  async updateCoupleInfo(data: Partial<CoupleInfo>): Promise<boolean> {
    try {
      const setClause: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      // Build dynamic SET clause for provided fields only
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
          setClause.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      });

      if (setClause.length === 0) return false;

      const query = `
        UPDATE couple_info 
        SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT MIN(id) FROM couple_info)
        RETURNING *
      `;

      const result = await this.executeQuery(query, values, "updateCoupleInfo");
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error updating couple info:", error);
      return false;
    }
  }

  // ========================================
  // EVENT METHODS (Enhanced with PostgreSQL - All Async)
  // ========================================

  /**
   * Get All Events - Legacy Method with Enhanced Features (Now Async)
   * Maintains backward compatibility while adding new capabilities
   */
  async getAllEvents(): Promise<Event[]> {
    const enhancedEvents = await this.getFilteredEvents({}, 1000, 0);
    return enhancedEvents.map((event) => ({
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
   * Enhanced Event Filtering with Comprehensive PostgreSQL Query Support
   * Implements high-performance filtering with caching and full-text search
   */
  async getFilteredEvents(
    filters: EventFilters = {},
    limit: number = 20,
    offset: number = 0
  ): Promise<EnhancedEvent[]> {
    // Generate cache key from filters
    const cacheKey = `filtered_events_${JSON.stringify(filters)}_${limit}_${offset}`;

    // Check cache first
    const cached = this.getCachedResult<EnhancedEvent[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Build dynamic query with parameterized conditions
      let query = `
        SELECT * FROM events 
        WHERE deleted_at IS NULL
      `;
      const params: any[] = [];
      let paramCount = 1;

      // Apply filters systematically with PostgreSQL parameter syntax
      if (filters.date_from) {
        query += ` AND date >= $${paramCount}`;
        params.push(filters.date_from);
        paramCount++;
      }

      if (filters.date_to) {
        query += ` AND date <= $${paramCount}`;
        params.push(filters.date_to);
        paramCount++;
      }

      if (filters.category) {
        query += ` AND category = $${paramCount}`;
        params.push(filters.category);
        paramCount++;
      }

      if (filters.priority) {
        query += ` AND priority = $${paramCount}`;
        params.push(filters.priority);
        paramCount++;
      }

      if (filters.search_term) {
        // Use PostgreSQL's full-text search capabilities
        query += ` AND search_vector @@ plainto_tsquery('english', $${paramCount})`;
        params.push(filters.search_term.trim());
        paramCount++;
      }

      if (filters.show_recurring === false) {
        query += ` AND is_recurring = FALSE`;
      }

      if (!filters.show_past) {
        query += ` AND date >= CURRENT_TIMESTAMP`;
      }

      // Apply sorting and pagination
      query += ` ORDER BY date ASC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const result = await this.executeQuery<any>(query, params, "getFilteredEvents");

      // Parse and transform results
      const parsedResults: EnhancedEvent[] = result.rows.map(this.parseEventFromDB);

      // Cache successful results
      this.setCachedResult(cacheKey, parsedResults);

      return parsedResults;
    } catch (error) {
      console.error("Error fetching filtered events:", error);
      return [];
    }
  }

  /**
   * Get Count of Filtered Events for Pagination (Async)
   * Optimized count query without fetching actual data
   */
  async getFilteredEventsCount(filters: EventFilters = {}): Promise<number> {
    // Generate cache key for count query
    const cacheKey = `filtered_events_count_${JSON.stringify(filters)}`;

    // Check cache first
    const cached = this.getCachedResult<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      // Build optimized COUNT query (same filter logic as getFilteredEvents)
      let query = `
        SELECT COUNT(*) as count FROM events 
        WHERE deleted_at IS NULL
      `;
      const params: any[] = [];
      let paramCount = 1;

      // Apply same filters as getFilteredEvents
      if (filters.date_from) {
        query += ` AND date >= $${paramCount}`;
        params.push(filters.date_from);
        paramCount++;
      }

      if (filters.date_to) {
        query += ` AND date <= $${paramCount}`;
        params.push(filters.date_to);
        paramCount++;
      }

      if (filters.category) {
        query += ` AND category = $${paramCount}`;
        params.push(filters.category);
        paramCount++;
      }

      if (filters.priority) {
        query += ` AND priority = $${paramCount}`;
        params.push(filters.priority);
        paramCount++;
      }

      if (filters.search_term) {
        query += ` AND search_vector @@ plainto_tsquery('english', $${paramCount})`;
        params.push(filters.search_term.trim());
        paramCount++;
      }

      if (filters.show_recurring === false) {
        query += ` AND is_recurring = FALSE`;
      }

      if (!filters.show_past) {
        query += ` AND date >= CURRENT_TIMESTAMP`;
      }

      const result = await this.executeQuery<{ count: string }>(
        query, 
        params, 
        "getFilteredEventsCount"
      );

      const count = parseInt(result.rows[0]?.count || '0', 10);

      // Cache result for 2 minutes (counts change less frequently)
      this.setCachedResult(cacheKey, count, 2 * 60 * 1000);

      return count;
    } catch (error) {
      console.error("Error counting filtered events:", error);
      return 0;
    }
  }

  /**
   * Get Total Events Count (Async)
   */
  async getTotalEventsCount(): Promise<number> {
    const cacheKey = "total_events_count";
    const cached = this.getCachedResult<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const result = await this.executeQuery<{ count: string }>(
        "SELECT COUNT(*) as count FROM events WHERE deleted_at IS NULL",
        [],
        "getTotalEventsCount"
      );

      const totalCount = parseInt(result.rows[0]?.count || '0', 10);
      this.setCachedResult(cacheKey, totalCount, 5 * 60 * 1000);
      return totalCount;
    } catch (error) {
      console.error("Error getting total events count:", error);
      return 0;
    }
  }

  /**
   * Get Upcoming Events with Enhanced Intelligence (Async)
   */
  async getUpcomingEvents(limit: number = 5, offset: number = 0): Promise<Event[]> {
    try {
      const query = `
        SELECT * FROM events 
        WHERE deleted_at IS NULL AND date >= CURRENT_DATE
        ORDER BY 
          CASE WHEN date::date = CURRENT_DATE THEN 0 ELSE 1 END,  -- Today's events first
          CASE WHEN priority = 'high' THEN 0 WHEN priority = 'medium' THEN 1 ELSE 2 END,  -- Priority order
          date ASC 
        LIMIT $1 OFFSET $2
      `;

      const result = await this.executeQuery<any>(
        query,
        [limit, offset],
        "getUpcomingEvents"
      );

      return result.rows.map((event) => ({
        id: event.id,
        title: event.title,
        date: event.date,
        description: event.description,
        is_recurring: Boolean(event.is_recurring),
        created_at: event.created_at,
        updated_at: event.updated_at,
      }));
    } catch (error) {
      console.error("Database read error:", error);
      return [];
    }
  }

  /**
   * Get Upcoming Events Count (Async)
   */
  async getUpcomingEventsCount(): Promise<number> {
    const cacheKey = "upcoming_events_count";
    const cached = this.getCachedResult<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const result = await this.executeQuery<{ count: string }>(
        "SELECT COUNT(*) as count FROM events WHERE deleted_at IS NULL AND date >= CURRENT_TIMESTAMP",
        [],
        "getUpcomingEventsCount"
      );

      const upcomingCount = parseInt(result.rows[0]?.count || '0', 10);
      this.setCachedResult(cacheKey, upcomingCount, 2 * 60 * 1000);
      return upcomingCount;
    } catch (error) {
      console.error("Error counting upcoming events:", error);
      return 0;
    }
  }

  /**
   * Get Past Events Count (Async)
   */
  async getPastEventsCount(): Promise<number> {
    const cacheKey = "past_events_count";
    const cached = this.getCachedResult<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const result = await this.executeQuery<{ count: string }>(
        "SELECT COUNT(*) as count FROM events WHERE deleted_at IS NULL AND date < CURRENT_TIMESTAMP",
        [],
        "getPastEventsCount"
      );

      const pastCount = parseInt(result.rows[0]?.count || '0', 10);
      this.setCachedResult(cacheKey, pastCount, 10 * 60 * 1000);
      return pastCount;
    } catch (error) {
      console.error("Error counting past events:", error);
      return 0;
    }
  }

  /**
   * Get Recurring Events Count (Async)
   */
  async getRecurringEventsCount(): Promise<number> {
    const cacheKey = "recurring_events_count";
    const cached = this.getCachedResult<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const result = await this.executeQuery<{ count: string }>(
        "SELECT COUNT(*) as count FROM events WHERE deleted_at IS NULL AND is_recurring = TRUE",
        [],
        "getRecurringEventsCount"
      );

      const recurringCount = parseInt(result.rows[0]?.count || '0', 10);
      this.setCachedResult(cacheKey, recurringCount, 15 * 60 * 1000);
      return recurringCount;
    } catch (error) {
      console.error("Error counting recurring events:", error);
      return 0;
    }
  }

  /**
   * Get Events This Month Count (Async)
   */
  async getEventsThisMonthCount(): Promise<number> {
    const cacheKey = "events_this_month_count";
    const cached = this.getCachedResult<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const result = await this.executeQuery<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM events 
         WHERE deleted_at IS NULL 
           AND date >= date_trunc('month', CURRENT_TIMESTAMP) 
           AND date < date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month'`,
        [],
        "getEventsThisMonthCount"
      );

      const thisMonthCount = parseInt(result.rows[0]?.count || '0', 10);
      this.setCachedResult(cacheKey, thisMonthCount, 5 * 60 * 1000);
      return thisMonthCount;
    } catch (error) {
      console.error("Error counting events this month:", error);
      return 0;
    }
  }

  /**
   * Enhanced Event Statistics (Async)
   */
  async getEventStats(): Promise<EventStats> {
    const cacheKey = "event_stats";
    const cached = this.getCachedResult<EventStats>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_events,
          COUNT(CASE WHEN date >= CURRENT_TIMESTAMP AND deleted_at IS NULL THEN 1 END) as upcoming_events,
          COUNT(CASE WHEN date < CURRENT_TIMESTAMP AND deleted_at IS NULL THEN 1 END) as past_events,
          COUNT(CASE WHEN is_recurring = TRUE AND deleted_at IS NULL THEN 1 END) as recurring_events,
          COUNT(CASE WHEN date >= date_trunc('month', CURRENT_TIMESTAMP) 
                     AND date < date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month' 
                     AND deleted_at IS NULL THEN 1 END) as events_this_month
        FROM events 
        WHERE deleted_at IS NULL
      `;

      const statsResult = await this.executeQuery<any>(statsQuery, [], "getEventStats");
      const stats = statsResult.rows[0];

      // Get next upcoming event
      const nextEventResult = await this.executeQuery<any>(
        `SELECT * FROM events 
         WHERE deleted_at IS NULL AND date >= CURRENT_TIMESTAMP
         ORDER BY date ASC, CASE WHEN priority = 'high' THEN 0 WHEN priority = 'medium' THEN 1 ELSE 2 END
         LIMIT 1`,
        [],
        "getNextEvent"
      );

      const result: EventStats = {
        total_events: parseInt(stats.total_events, 10),
        upcoming_events: parseInt(stats.upcoming_events, 10),
        past_events: parseInt(stats.past_events, 10),
        recurring_events: parseInt(stats.recurring_events, 10),
        events_this_month: parseInt(stats.events_this_month, 10),
        next_event: nextEventResult.rows[0] ? this.parseEventFromDB(nextEventResult.rows[0]) : undefined,
      };

      this.setCachedResult(cacheKey, result, 60 * 1000);
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
   * Add Event - Legacy Method (Now Async)
   */
  async addEvent(event: Omit<Event, "id" | "created_at" | "updated_at">): Promise<number | null> {
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
   * Create Enhanced Event with PostgreSQL Transaction (Async)
   */
  async createEnhancedEvent(
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
  ): Promise<number | null> {
    const client = await this.pool.connect();
    
    try {
      // Begin transaction
      await client.query('BEGIN');

      // Insert main event record
      const insertQuery = `
        INSERT INTO events (
          title, description, date, timezone, is_all_day, location,
          category, priority, is_recurring, recurring_config,
          reminder_minutes, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `;

      const values = [
        eventData.title,
        eventData.description || null,
        eventData.date,
        eventData.timezone || "UTC",
        eventData.is_all_day || false,
        eventData.location || null,
        eventData.category,
        eventData.priority,
        eventData.is_recurring,
        eventData.recurring_config ? JSON.stringify(eventData.recurring_config) : null,
        eventData.reminder_minutes || null,
        userId,
        userId
      ];

      const result = await client.query(insertQuery, values);
      const eventId = result.rows[0].id;

      // Create audit trail entry
      await client.query(
        `INSERT INTO event_history (event_id, action, new_values, changed_by)
         VALUES ($1, 'created', $2, $3)`,
        [eventId, JSON.stringify(eventData), userId]
      );

      // Schedule reminder if needed
      if (eventData.reminder_minutes) {
        const eventDate = new Date(eventData.date);
        const reminderTime = new Date(
          eventDate.getTime() - eventData.reminder_minutes * 60 * 1000
        );

        await client.query(
          `INSERT INTO event_reminders (event_id, reminder_time)
           VALUES ($1, $2)`,
          [eventId, reminderTime.toISOString()]
        );
      }

      // Commit transaction
      await client.query('COMMIT');

      // Invalidate relevant caches
      this.invalidateCache("events");

      return eventId;
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      console.error("Error creating enhanced event:", error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Update Event (Legacy Method - Now Async)
   */
  async updateEvent(id: number, event: Partial<Event>): Promise<boolean> {
    return this.updateEnhancedEvent(id, {
      title: event.title,
      date: event.date,
      description: event.description,
      is_recurring: event.is_recurring,
    });
  }

  /**
   * Update Enhanced Event with PostgreSQL Transaction (Async)
   */
  async updateEnhancedEvent(
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
  ): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get current event for change detection
      const currentResult = await client.query(
        "SELECT * FROM events WHERE id = $1 AND deleted_at IS NULL",
        [eventId]
      );

      if (currentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const currentEvent = currentResult.rows[0];

      // Track changes for audit trail
      const changes: Record<string, { old: any; new: any }> = {};
      const changedFields: string[] = [];

      // Build update query dynamically
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramCount = 1;

      Object.entries(eventData).forEach(([key, value]) => {
        if (value !== undefined && currentEvent[key] !== value) {
          changes[key] = { old: currentEvent[key], new: value };
          changedFields.push(key);

          if (key === "recurring_config") {
            updateFields.push(`${key} = $${paramCount}`);
            updateValues.push(value ? JSON.stringify(value) : null);
          } else {
            updateFields.push(`${key} = $${paramCount}`);
            updateValues.push(value);
          }
          paramCount++;
        }
      });

      if (updateFields.length === 0) {
        await client.query('ROLLBACK');
        return true; // No changes
      }

      // Add metadata fields
      updateFields.push(`updated_by = $${paramCount}`);
      updateValues.push(userId);
      paramCount++;
      
      updateFields.push(`version = version + 1`);
      updateValues.push(eventId);

      // Update main event record
      const updateQuery = `
        UPDATE events 
        SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount} AND deleted_at IS NULL
      `;

      const updateResult = await client.query(updateQuery, updateValues);

      if (updateResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      // Create audit trail entry
      await client.query(
        `INSERT INTO event_history (
          event_id, action, changed_fields, old_values, new_values, changed_by
        ) VALUES ($1, 'updated', $2, $3, $4, $5)`,
        [
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
        ]
      );

      await client.query('COMMIT');
      this.invalidateCache("events");
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Error updating enhanced event:", error);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Delete Event with PostgreSQL Transaction (Async)
   */
  async deleteEvent(id: number, userId?: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get event data for audit trail
      const eventResult = await client.query(
        "SELECT * FROM events WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );

      if (eventResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const event = eventResult.rows[0];

      // Soft delete the event
      const deleteResult = await client.query(
        `UPDATE events 
         SET deleted_at = CURRENT_TIMESTAMP, updated_by = $1, version = version + 1
         WHERE id = $2 AND deleted_at IS NULL`,
        [userId, id]
      );

      if (deleteResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      // Create audit trail entry
      await client.query(
        `INSERT INTO event_history (event_id, action, old_values, changed_by)
         VALUES ($1, 'deleted', $2, $3)`,
        [id, JSON.stringify(event), userId]
      );

      // Cancel pending reminders
      await client.query(
        `UPDATE event_reminders 
         SET status = 'cancelled' 
         WHERE event_id = $1 AND status = 'pending'`,
        [id]
      );

      await client.query('COMMIT');
      this.invalidateCache("events");
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Error deleting event:", error);
      return false;
    } finally {
      client.release();
    }
  }

  // ========================================
  // USER METHODS (Now Async)
  // ========================================

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await this.executeQuery<User>(
        "SELECT * FROM users WHERE email = $1",
        [email],
        "getUserByEmail"
      );
      return result.rows[0];
    } catch (error) {
      console.error("Database read error:", error);
      return undefined;
    }
  }

  // ========================================
  // PHOTO METHODS (Now Async)
  // ========================================

  async getAllPhotos(): Promise<Photo[]> {
    try {
      const result = await this.executeQuery<Photo>(
        "SELECT * FROM photos ORDER BY upload_date DESC",
        [],
        "getAllPhotos"
      );
      return result.rows;
    } catch (error) {
      console.error("Database read error:", error);
      return [];
    }
  }

  async addPhoto(photo: Omit<Photo, "id" | "created_at">): Promise<number | null> {
    try {
      const result = await this.executeQuery<{ id: number }>(
        `INSERT INTO photos (cloudinary_id, public_url, title, description, upload_date)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          photo.cloudinary_id,
          photo.public_url,
          photo.title,
          photo.description,
          photo.upload_date
        ],
        "addPhoto"
      );

      return result.rows[0]?.id || null;
    } catch (error) {
      console.error("Error adding photo:", error);
      return null;
    }
  }

  async updatePhoto(
    id: number,
    data: { title?: string; description?: string }
  ): Promise<boolean> {
    try {
      const setClause = [];
      const values = [];
      let paramCount = 1;

      if (data.title !== undefined) {
        setClause.push(`title = $${paramCount}`);
        values.push(data.title);
        paramCount++;
      }

      if (data.description !== undefined) {
        setClause.push(`description = $${paramCount}`);
        values.push(data.description);
        paramCount++;
      }

      if (setClause.length === 0) return false;

      values.push(id);
      const query = `
        UPDATE photos 
        SET ${setClause.join(', ')}
        WHERE id = $${paramCount}
      `;

      const result = await this.executeQuery(query, values, "updatePhoto");
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error updating photo:", error);
      return false;
    }
  }

  async deletePhoto(id: number): Promise<Photo | null> {
    try {
      // Get photo first
      const photoResult = await this.executeQuery<Photo>(
        "SELECT * FROM photos WHERE id = $1",
        [id],
        "getPhoto"
      );
      
      if (photoResult.rows.length === 0) return null;
      const photo = photoResult.rows[0];

      // Delete photo
      const deleteResult = await this.executeQuery(
        "DELETE FROM photos WHERE id = $1",
        [id],
        "deletePhoto"
      );

      return deleteResult.rowCount > 0 ? photo : null;
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
      recurring_config: dbEvent.recurring_config || undefined,
      is_recurring: Boolean(dbEvent.is_recurring),
      is_all_day: Boolean(dbEvent.is_all_day),
      version: dbEvent.version || 1,
    };
  }

  /**
   * Get Performance Metrics for Monitoring
   */
  getPerformanceMetrics(): Record<
    string,
    { count: number; avgTime: number; totalTime: number }
  > {
    return Object.fromEntries(this.performanceMetrics.entries());
  }

  /**
   * Database Maintenance and Optimization (Async)
   */
  async performMaintenance(): Promise<void> {
    try {
      console.log("🔧 Starting PostgreSQL database maintenance...");

      // Analyze tables for query optimization
      await this.executeQuery("ANALYZE events", [], "maintenance_analyze");
      await this.executeQuery("ANALYZE event_history", [], "maintenance_analyze");
      await this.executeQuery("ANALYZE couple_info", [], "maintenance_analyze");
      await this.executeQuery("ANALYZE photos", [], "maintenance_analyze");
      await this.executeQuery("ANALYZE users", [], "maintenance_analyze");

      // Clean up old performance data (keep last 30 days)
      await this.executeQuery(
        `DELETE FROM query_performance 
         WHERE executed_at < CURRENT_TIMESTAMP - INTERVAL '30 days'`,
        [],
        "maintenance_cleanup"
      );

      // Clean up old audit trail (keep last 90 days)
      await this.executeQuery(
        `DELETE FROM event_history 
         WHERE changed_at < CURRENT_TIMESTAMP - INTERVAL '90 days'`,
        [],
        "maintenance_cleanup"
      );

      // Clear expired cache entries
      this.invalidateCache();

      // Get database size information
      const sizeResult = await this.executeQuery<{ size: string }>(
        `SELECT pg_size_pretty(pg_database_size(current_database())) as size`,
        [],
        "maintenance_stats"
      );

      console.log(`📊 Database size: ${sizeResult.rows[0]?.size || 'Unknown'}`);
      console.log(`🗂️ Cache entries: ${this.queryCache.size}`);
      console.log(`📈 Performance metrics tracked: ${this.performanceMetrics.size} query types`);

      console.log("✅ PostgreSQL database maintenance completed");
    } catch (error) {
      console.error("❌ Database maintenance failed:", error);
    }
  }

  /**
   * Schedule Periodic Maintenance Tasks
   */
  private scheduleMaintenanceTasks(): void {
    const maintenanceInterval =
      process.env.NODE_ENV === "production"
        ? 6 * 60 * 60 * 1000  // 6 hours in production
        : 60 * 60 * 1000;     // 1 hour in development

    setInterval(() => {
      this.performMaintenance().catch((error) => {
        console.error("Scheduled maintenance failed:", error);
      });
    }, maintenanceInterval);
  }

  /**
   * Enhanced Default Data Seeding for PostgreSQL (Async)
   */
  private async seedDefaultData(client: PoolClient): Promise<void> {
    try {
      const coupleResult = await client.query("SELECT COUNT(*) as count FROM couple_info");
      const userResult = await client.query("SELECT COUNT(*) as count FROM users");

      const coupleCount = parseInt(coupleResult.rows[0].count, 10);
      const userCount = parseInt(userResult.rows[0].count, 10);

      if (coupleCount === 0) {
        await client.query(
          `INSERT INTO couple_info (male_name, female_name, love_start_date, male_birthday, female_birthday)
           VALUES ($1, $2, $3, $4, $5)`,
          ["Bá An", "Kiều Trâm", "2025-01-27", "06-06", "08-12"]
        );
        console.log("💕 Default couple information created");
      }

      if (userCount === 0) {
        const defaultPassword = "anandtram1206";
        const hashedPassword = await bcrypt.hash(defaultPassword, 12);

        await client.query(
          `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)`,
          ["an@gmail.com", hashedPassword, "An"]
        );
        
        await client.query(
          `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)`,
          ["tram@gmail.com", hashedPassword, "Trâm"]
        );

        console.log("👤 Default user accounts created");

        // Create sample enhanced events
        await this.createSampleEvents(client);
        console.log("🎉 Sample events created");
      }
    } catch (error) {
      console.error("❌ Default data seeding failed:", error);
    }
  }

  /**
   * Create sample events for demo purposes
   */
  private async createSampleEvents(client: PoolClient): Promise<void> {
    const sampleEvents = [
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
      }
    ];

    for (const eventData of sampleEvents) {
      await client.query(
        `INSERT INTO events (
          title, description, date, timezone, is_all_day, location,
          category, priority, is_recurring, recurring_config,
          reminder_minutes, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          eventData.title,
          eventData.description,
          eventData.date,
          eventData.timezone,
          eventData.is_all_day,
          eventData.location,
          eventData.category,
          eventData.priority,
          eventData.is_recurring,
          JSON.stringify(eventData.recurring_config),
          eventData.reminder_minutes,
          "1", // created_by
          "1"  // updated_by
        ]
      );
    }
  }

  /**
   * Safe Database Connection Closure
   */
  async close(): Promise<void> {
    if (this.pool) {
      try {
        // Clear all caches
        this.invalidateCache();

        // Close connection pool
        await this.pool.end();
        console.log("🔒 PostgreSQL connection pool closed");
      } catch (error) {
        console.error("Error closing database pool:", error);
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
  if (dbInstance && dbInstance['initialized']) {
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
            `Database initialization failed after ${maxRetries} attempts. Check PostgreSQL connection and environment variables.`
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
 */
export async function closeDatabaseConnection(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
    initializationPromise = null;
    console.log("🧹 Database connection cleanup completed");
  }
  
  // Close global pool if exists
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Get Database Performance Metrics
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
 */
export async function performDatabaseMaintenance(): Promise<void> {
  try {
    const db = await getDatabase();
    await db.performMaintenance();
  } catch (error) {
    console.error("Error performing database maintenance:", error);
  }
}