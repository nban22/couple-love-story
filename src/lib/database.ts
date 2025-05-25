import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import bcrypt from 'bcryptjs';

/**
 * Database path configuration with automatic directory creation
 * Critical: Ensures data directory exists before database initialization
 * Performance: Uses synchronous filesystem operations during startup only
 */
const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'couple.db');

/**
 * Directory validation and creation utility
 * Implements defensive programming to prevent runtime database errors
 * Returns boolean success status for error handling
 */
function ensureDataDirectoryExists(): boolean {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
      console.log(`📁 Created data directory: ${DATA_DIR}`);
    }
    return true;
  } catch (error) {
    console.error('❌ Failed to create data directory:', error);
    return false;
  }
}

// Database interfaces remain unchanged for API compatibility
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

export interface Event {
  id: number;
  title: string;
  date: string;
  description?: string;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
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
 * Enhanced DatabaseManager with robust error handling
 * Implements fail-safe initialization with directory pre-validation
 * Maintains singleton pattern for optimal resource management
 */

class DatabaseManager {
  private db: Database.Database;

  constructor() {
    // Critical: Validate directory existence before database initialization
    if (!ensureDataDirectoryExists()) {
      throw new Error('Failed to initialize data directory for database');
    }

    try {
      // Initialize database with performance optimizations
      this.db = new Database(DB_PATH);
      
      // Enable WAL mode for better concurrent access
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      this.db.pragma('temp_store = MEMORY');
      
      console.log(`✅ Database initialized successfully: ${DB_PATH}`);
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
    
    this.initializeTables();
    this.seedDefaultData();
  }

  private initializeTables() {
    try {
      // Create tables with proper constraints and indexes
      this.db.exec(`
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

        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          date TEXT NOT NULL,
          description TEXT,
          is_recurring BOOLEAN DEFAULT 0,
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

        CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
        CREATE INDEX IF NOT EXISTS idx_photos_upload_date ON photos(upload_date);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `);
      
      console.log('📋 Database tables initialized successfully');
    } catch (error) {
      console.error('❌ Table initialization failed:', error);
      throw error;
    }
  }

  private async seedDefaultData() {
    try {
      // Check if default data already exists
      const coupleCount = this.db.prepare('SELECT COUNT(*) as count FROM couple_info').get() as { count: number };
      const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

      if (coupleCount.count === 0) {
        // Insert default couple info - modify these values
        this.db.prepare(`
          INSERT INTO couple_info (male_name, female_name, love_start_date, male_birthday, female_birthday)
          VALUES (?, ?, ?, ?, ?)
        `).run('My Love', 'My Heart', '2024-01-14', '03-15', '07-22');
        
        console.log('💕 Default couple information created');
      }

      if (userCount.count === 0) {
        // Create default user accounts with hashed passwords
        const defaultPassword = 'LoveStory123!';
        const hashedPassword = await bcrypt.hash(defaultPassword, 12);

        const insertUser = this.db.prepare(`
          INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)
        `);

        insertUser.run('couple1@love.story', hashedPassword, 'Partner 1');
        insertUser.run('couple2@love.story', hashedPassword, 'Partner 2');
        
        console.log('👤 Default user accounts created');
      }
    } catch (error) {
      console.error('❌ Default data seeding failed:', error);
      // Non-fatal error - application can continue without default data
    }
  }

  // All CRUD operations remain unchanged for API compatibility
  getCoupleInfo(): CoupleInfo | undefined {
    try {
      return this.db.prepare('SELECT * FROM couple_info LIMIT 1').get() as CoupleInfo | undefined;
    } catch (error) {
      console.error('Database read error:', error);
      return undefined;
    }
  }

  updateCoupleInfo(data: Partial<CoupleInfo>): boolean {
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
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating couple info:', error);
      return false;
    }
  }

  getAllEvents(): Event[] {
    try {
      return this.db.prepare('SELECT * FROM events ORDER BY date ASC').all() as Event[];
    } catch (error) {
      console.error('Database read error:', error);
      return [];
    }
  }

  getUpcomingEvents(limit: number = 5): Event[] {
    try {
      const today = new Date().toISOString().split('T')[0];
      return this.db.prepare(`
        SELECT * FROM events 
        WHERE date >= ? 
        ORDER BY date ASC 
        LIMIT ?
      `).all(today, limit) as Event[];
    } catch (error) {
      console.error('Database read error:', error);
      return [];
    }
  }

  addEvent(event: Omit<Event, 'id' | 'created_at' | 'updated_at'>): number | null {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO events (title, date, description, is_recurring)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = stmt.run(event.title, event.date, event.description, event.is_recurring);
      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Error adding event:', error);
      return null;
    }
  }

  updateEvent(id: number, event: Partial<Event>): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE events 
        SET title = COALESCE(?, title),
            date = COALESCE(?, date),
            description = COALESCE(?, description),
            is_recurring = COALESCE(?, is_recurring),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      const result = stmt.run(event.title, event.date, event.description, event.is_recurring, id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating event:', error);
      return false;
    }
  }

  deleteEvent(id: number): boolean {
    try {
      const result = this.db.prepare('DELETE FROM events WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting event:', error);
      return false;
    }
  }

  getUserByEmail(email: string): User | undefined {
    try {
      return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
    } catch (error) {
      console.error('Database read error:', error);
      return undefined;
    }
  }

  getAllPhotos(): Photo[] {
    try {
      return this.db.prepare('SELECT * FROM photos ORDER BY upload_date DESC').all() as Photo[];
    } catch (error) {
      console.error('Database read error:', error);
      return [];
    }
  }

  addPhoto(photo: Omit<Photo, 'id' | 'created_at'>): number | null {
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
      
      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Error adding photo:', error);
      return null;
    }
  }

  deletePhoto(id: number): Photo | null {
    try {
      const photo = this.db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as Photo;
      if (!photo) return null;
      
      const result = this.db.prepare('DELETE FROM photos WHERE id = ?').run(id);
      return result.changes > 0 ? photo : null;
    } catch (error) {
      console.error('Error deleting photo:', error);
      return null;
    }
  }

  close() {
    try {
      this.db.close();
      console.log('🔒 Database connection closed');
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }
}

// Enhanced singleton with error handling
let dbInstance: DatabaseManager | null = null;

export function getDatabase(): DatabaseManager {
  if (!dbInstance) {
    try {
      dbInstance = new DatabaseManager();
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      throw new Error('Database initialization failed. Please check data directory permissions.');
    }
  }
  return dbInstance;
}

export function closeDatabaseConnection() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}