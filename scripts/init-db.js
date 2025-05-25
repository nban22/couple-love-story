const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

/**
 * Database initialization script for development and production setup
 * Creates necessary directories, initializes database, and seeds default data
 * Run this script before starting the application for the first time
 */

async function initializeDatabase() {
  console.log('🚀 Initializing couple love story database...');
  
  try {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('📁 Created data directory');
    }
    
    // Initialize database
    const dbPath = path.join(dataDir, 'couple.db');
    const db = new Database(dbPath);
    
    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 1000');
    db.pragma('temp_store = MEMORY');
    
    console.log('📊 Database connected successfully');
    
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS couple_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        male_name TEXT NOT NULL DEFAULT 'Him',
        female_name TEXT NOT NULL DEFAULT 'Her',
        love_start_date TEXT NOT NULL DEFAULT '2024-01-01',
        male_birthday TEXT NOT NULL DEFAULT '01-01',
        female_birthday TEXT NOT NULL DEFAULT '01-01',
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
    
    console.log('📋 Database tables created successfully');
    
    // Check if data already exists
    const existingCouple = db.prepare('SELECT COUNT(*) as count FROM couple_info').get();
    const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
    
    if (existingCouple.count === 0) {
      // Insert default couple information
      db.prepare(`
        INSERT INTO couple_info (male_name, female_name, love_start_date, male_birthday, female_birthday)
        VALUES (?, ?, ?, ?, ?)
      `).run('My Love', 'My Heart', '2024-01-14', '03-15', '07-22');
      
      console.log('💕 Default couple information created');
    }
    
    if (existingUsers.count === 0) {
      // Create default user accounts
      const defaultPassword = 'LoveStory123!';
      const hashedPassword = await bcrypt.hash(defaultPassword, 12);
      
      const insertUser = db.prepare(`
        INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)
      `);
      
      insertUser.run('couple1@love.story', hashedPassword, 'Partner 1');
      insertUser.run('couple2@love.story', hashedPassword, 'Partner 2');
      
      console.log('👤 Default user accounts created');
      console.log('📧 Email: couple1@love.story / couple2@love.story');
      console.log('🔐 Password: LoveStory123!');
    }
    
    // Add some sample events
    const existingEvents = db.prepare('SELECT COUNT(*) as count FROM events').get();
    if (existingEvents.count === 0) {
      const insertEvent = db.prepare(`
        INSERT INTO events (title, date, description, is_recurring) VALUES (?, ?, ?, ?)
      `);
      
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 14);
      const anniversary = new Date(today.getFullYear(), 0, 14); // January 14th
      
      insertEvent.run(
        'Monthly Date Night', 
        nextMonth.toISOString().split('T')[0], 
        'Our special time together', 
        false
      );
      
      insertEvent.run(
        'Our Anniversary', 
        anniversary.toISOString().split('T')[0], 
        'The day our love story began', 
        true
      );
      
      console.log('📅 Sample events created');
    }
    
    db.close();
    console.log('✅ Database initialization completed successfully!');
    console.log('');
    console.log('🎉 Your couple love story website is ready!');
    console.log('💡 Next steps:');
    console.log('   1. Copy .env.local.example to .env.local');
    console.log('   2. Configure your Cloudinary credentials');
    console.log('   3. Run npm run dev to start the development server');
    console.log('   4. Visit http://localhost:3000 to see your love story');
    console.log('');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run initialization if this script is executed directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };