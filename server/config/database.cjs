const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Ensure database directory exists
const dbDir = path.join(__dirname, '../../database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('📁 Created database directory');
}

const dbPath = process.env.DATABASE_PATH || path.join(dbDir, 'memorypalace.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Connected to SQLite database at:', dbPath);
        initializeDatabase();
    }
});

// Initialize database schema
function initializeDatabase() {
    db.serialize(() => {
        // Blocks table - preserving existing data
        db.run(`
            CREATE TABLE IF NOT EXISTS blocks (
                id TEXT PRIMARY KEY,
                position_x REAL NOT NULL,
                position_y REAL NOT NULL,
                position_z REAL NOT NULL,
                type TEXT DEFAULT 'cube',
                text TEXT DEFAULT '',
                title TEXT DEFAULT '',
                blockSize REAL DEFAULT 5.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `, (err) => {
            if (err) {
                console.error('❌ Error creating blocks table:', err);
            } else {
                console.log('✅ Blocks table ready (preserving existing data)');
                // Add title column if it doesn't exist
                db.run(`
                    ALTER TABLE blocks ADD COLUMN title TEXT DEFAULT '';
                `, (alterErr) => {
                    if (alterErr && !alterErr.message.includes('duplicate column name')) {
                        console.error('❌ Error adding title column to blocks table:', alterErr);
                    } else if (!alterErr) {
                        console.log('✅ Blocks table updated with title column');
                    }
                });
            }
        });

        // Camera state table
        db.run(`
            CREATE TABLE IF NOT EXISTS camera_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                position_x REAL DEFAULT 5,
                position_y REAL DEFAULT 1.8,
                position_z REAL DEFAULT 5,
                rotation_x REAL DEFAULT 0,
                rotation_y REAL DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating camera_state table:', err);
            } else {
                console.log('✅ Camera state table ready');

                // Insert default camera state if not exists
                db.run(`
                    INSERT OR IGNORE INTO camera_state (id, position_x, position_y, position_z, rotation_x, rotation_y)
                    VALUES (1, 5, 1.8, 5, 0, 0)
                `);
            }
        });

        // Settings table
        db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating settings table:', err);
            } else {
                console.log('✅ Settings table ready');
            }
        });
    });
}

// Graceful shutdown - only exit on actual SIGINT, not during normal operation
let isShuttingDown = false;

process.on('SIGINT', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('🛑 Received SIGINT, shutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing database:', err);
        } else {
            console.log('✅ Database connection closed');
        }
        process.exit(0);
    });
});

// Handle other termination signals
process.on('SIGTERM', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing database:', err);
        } else {
            console.log('✅ Database connection closed');
        }
        process.exit(0);
    });
});

module.exports = db;