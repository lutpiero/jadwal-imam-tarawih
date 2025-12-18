const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const DB_PATH = path.join(__dirname, 'jadwal-imam.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database schema
function initializeDatabase() {
    db.serialize(() => {
        // Settings table
        db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Imams table
        db.run(`
            CREATE TABLE IF NOT EXISTS imams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                access_code TEXT NOT NULL UNIQUE,
                quota INTEGER NOT NULL DEFAULT 3,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Bookings table
        db.run(`
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date_key TEXT NOT NULL,
                imam_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (imam_id) REFERENCES imams(id) ON DELETE CASCADE,
                UNIQUE(date_key)
            )
        `);

        // Admin users table
        db.run(`
            CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Admin sessions table
        db.run(`
            CREATE TABLE IF NOT EXISTS admin_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
            )
        `);

        // Create indexes for performance
        db.run('CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date_key)');
        db.run('CREATE INDEX IF NOT EXISTS idx_bookings_imam ON bookings(imam_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_imams_access_code ON imams(access_code)');
        db.run('CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token)');

        // Create default admin user if it doesn't exist
        createDefaultAdmin();

        console.log('Database schema initialized');
    });
}

// Create default admin user
async function createDefaultAdmin() {
    try {
        const bcrypt = require('bcrypt');
        const existing = await getQuery('SELECT id FROM admin_users WHERE username = ?', ['admin']);
        
        if (!existing) {
            const passwordHash = await bcrypt.hash('admin123', 10);
            await runQuery(
                'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
                ['admin', passwordHash]
            );
            console.log('Default admin user created (username: admin, password: admin123)');
        }
    } catch (error) {
        console.error('Error creating default admin user:', error);
    }
}

// Helper function to run queries with promises
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
}

// Helper function to get single row
function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Helper function to get all rows
function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

module.exports = {
    db,
    runQuery,
    getQuery,
    allQuery
};
