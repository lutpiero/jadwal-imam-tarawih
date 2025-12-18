const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { runQuery, getQuery, allQuery } = require('./database');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting for login attempts (in-memory store)
// Note: This in-memory store will not persist across server restarts
// For production multi-instance deployments, consider using Redis or a database-backed store
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_TIMEOUT = 15 * 60 * 1000; // 15 minutes

function rateLimitLogin(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress;
    const now = Date.now();
    
    if (loginAttempts.has(ip)) {
        const attempts = loginAttempts.get(ip);
        const recentAttempts = attempts.filter(time => now - time < LOGIN_TIMEOUT);
        
        if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
            return res.status(429).json({ 
                error: 'Too many login attempts. Please try again later.' 
            });
        }
        
        loginAttempts.set(ip, recentAttempts);
    }
    
    next();
}

// Authentication middleware
async function requireAdmin(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const token = authHeader.substring(7);
        
        const session = await getQuery(`
            SELECT admin_sessions.*, admin_users.username, admin_users.id as admin_id
            FROM admin_sessions
            JOIN admin_users ON admin_sessions.admin_id = admin_users.id
            WHERE admin_sessions.token = ? AND admin_sessions.expires_at > datetime('now')
        `, [token]);
        
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
        
        req.adminUser = {
            id: session.admin_id,
            username: session.username
        };
        
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}

// Serve only specific static files (not the entire directory)
// Note: Rate limiting is not implemented for static files
// For production deployment with high traffic, consider adding rate limiting middleware
app.get('/app.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'app.js'));
});

// API Routes

// Admin Authentication Endpoints

// Admin login
app.post('/api/admin/login', rateLimitLogin, async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress;
    
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        // Log authentication attempt
        console.log(`Admin login attempt for username: ${username} from IP: ${ip}`);
        
        // Get admin user
        const admin = await getQuery(
            'SELECT id, username, password_hash FROM admin_users WHERE username = ?',
            [username]
        );
        
        if (!admin) {
            console.log(`Admin login failed: invalid username for ${username}`);
            // Track failed login attempt
            const now = Date.now();
            if (!loginAttempts.has(ip)) {
                loginAttempts.set(ip, []);
            }
            loginAttempts.get(ip).push(now);
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // Verify password
        const passwordValid = await bcrypt.compare(password, admin.password_hash);
        
        if (!passwordValid) {
            console.log(`Admin login failed: invalid password for ${username}`);
            // Track failed login attempt
            const now = Date.now();
            if (!loginAttempts.has(ip)) {
                loginAttempts.set(ip, []);
            }
            loginAttempts.get(ip).push(now);
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // Generate session token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        // Create session
        await runQuery(
            'INSERT INTO admin_sessions (admin_id, token, expires_at) VALUES (?, ?, ?)',
            [admin.id, token, expiresAt.toISOString()]
        );
        
        // Clear old expired sessions for this admin
        await runQuery(
            'DELETE FROM admin_sessions WHERE admin_id = ? AND expires_at < datetime("now")',
            [admin.id]
        );
        
        console.log(`Admin login successful for ${username}`);
        
        res.json({
            success: true,
            token,
            username: admin.username,
            expiresAt: expiresAt.toISOString()
        });
    } catch (error) {
        console.error('Error during admin login:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Admin logout
app.post('/api/admin/logout', requireAdmin, async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(400).json({ error: 'Invalid authorization header' });
        }
        
        const token = authHeader.substring(7);
        
        await runQuery('DELETE FROM admin_sessions WHERE token = ?', [token]);
        
        console.log(`Admin logout successful for ${req.adminUser.username}`);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error during admin logout:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Verify admin session
app.get('/api/admin/verify', requireAdmin, (req, res) => {
    res.json({
        success: true,
        username: req.adminUser.username
    });
});

// Get all settings
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await allQuery('SELECT key, value FROM settings');
        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.key] = setting.value;
        });
        res.json(settingsObj);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update Ramadhan start date (admin only)
app.put('/api/settings/ramadhan-start', requireAdmin, async (req, res) => {
    try {
        const { date } = req.body;
        
        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        await runQuery(`
            INSERT INTO settings (key, value, updated_at)
            VALUES ('ramadhanStartDate', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
        `, [date, date]);

        res.json({ success: true, date });
    } catch (error) {
        console.error('Error updating Ramadhan date:', error);
        res.status(500).json({ error: 'Failed to update date' });
    }
});

// Get all imams
app.get('/api/imams', async (req, res) => {
    try {
        const imams = await allQuery(`
            SELECT 
                id,
                name,
                access_code as accessCode,
                quota,
                created_at as createdAt,
                (SELECT COUNT(*) FROM bookings WHERE imam_id = imams.id) as booked
            FROM imams
            ORDER BY created_at DESC
        `);
        res.json(imams);
    } catch (error) {
        console.error('Error fetching imams:', error);
        res.status(500).json({ error: 'Failed to fetch imams' });
    }
});

// Create new imam (admin only)
app.post('/api/imams', requireAdmin, async (req, res) => {
    try {
        const { name, quota } = req.body;
        
        if (!name || !quota) {
            return res.status(400).json({ error: 'Name and quota are required' });
        }

        if (quota < 1 || quota > 30) {
            return res.status(400).json({ error: 'Quota must be between 1 and 30' });
        }

        // Generate unique 6-digit access code with retry limit
        let accessCode;
        let isUnique = false;
        let retries = 0;
        const MAX_RETRIES = 100;
        
        while (!isUnique && retries < MAX_RETRIES) {
            accessCode = Math.floor(100000 + Math.random() * 900000).toString();
            const existing = await getQuery('SELECT id FROM imams WHERE access_code = ?', [accessCode]);
            if (!existing) {
                isUnique = true;
            }
            retries++;
        }

        if (!isUnique) {
            return res.status(500).json({ error: 'Failed to generate unique access code. Please try again.' });
        }

        const result = await runQuery(
            'INSERT INTO imams (name, access_code, quota) VALUES (?, ?, ?)',
            [name, accessCode, quota]
        );

        const newImam = {
            id: result.id,
            name,
            accessCode,
            quota,
            booked: 0
        };

        res.status(201).json(newImam);
    } catch (error) {
        console.error('Error creating imam:', error);
        res.status(500).json({ error: 'Failed to create imam' });
    }
});

// Delete imam and their bookings (admin only)
app.delete('/api/imams/:id', requireAdmin, async (req, res) => {
    try {
        const imamId = parseInt(req.params.id);
        
        if (isNaN(imamId)) {
            return res.status(400).json({ error: 'Invalid imam ID' });
        }

        // Check if imam exists
        const imam = await getQuery('SELECT id FROM imams WHERE id = ?', [imamId]);
        if (!imam) {
            return res.status(404).json({ error: 'Imam not found' });
        }

        // Delete imam (CASCADE will automatically delete associated bookings)
        await runQuery('DELETE FROM imams WHERE id = ?', [imamId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting imam:', error);
        res.status(500).json({ error: 'Failed to delete imam' });
    }
});

// Get all bookings
app.get('/api/bookings', async (req, res) => {
    try {
        const bookings = await allQuery(`
            SELECT 
                id,
                date_key as dateKey,
                imam_id as imamId,
                created_at as createdAt
            FROM bookings
            ORDER BY date_key
        `);
        
        // Convert to object format matching localStorage structure
        const bookingsObj = {};
        bookings.forEach(booking => {
            bookingsObj[booking.dateKey] = booking.imamId;
        });
        
        res.json(bookingsObj);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// Delete a booking by date (admin only)
app.delete('/api/bookings/:dateKey', requireAdmin, async (req, res) => {
    try {
        const dateKey = req.params.dateKey;
        
        if (!dateKey) {
            return res.status(400).json({ error: 'Date key is required' });
        }

        // Check if booking exists
        const booking = await getQuery('SELECT id, imam_id FROM bookings WHERE date_key = ?', [dateKey]);
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Delete the booking
        await runQuery('DELETE FROM bookings WHERE date_key = ?', [dateKey]);

        console.log(`Admin ${req.adminUser.username} deleted booking for date ${dateKey}`);

        res.json({ success: true, message: 'Booking deleted successfully' });
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).json({ error: 'Failed to delete booking' });
    }
});

// Create/update bookings for an imam
app.post('/api/bookings', async (req, res) => {
    try {
        const { imamId, dates } = req.body;
        
        if (!imamId || !dates || !Array.isArray(dates)) {
            return res.status(400).json({ error: 'Imam ID and dates array are required' });
        }

        // Check if imam exists
        const imam = await getQuery('SELECT id, quota FROM imams WHERE id = ?', [imamId]);
        if (!imam) {
            return res.status(404).json({ error: 'Imam not found' });
        }

        // Get current bookings for this imam
        const currentBookings = await allQuery(
            'SELECT date_key FROM bookings WHERE imam_id = ?',
            [imamId]
        );
        
        const totalBookings = currentBookings.length + dates.length;
        if (totalBookings > imam.quota) {
            return res.status(400).json({ 
                error: `Total bookings (${totalBookings}) would exceed quota (${imam.quota})` 
            });
        }

        // Insert new bookings
        for (const dateKey of dates) {
            await runQuery(`
                INSERT INTO bookings (date_key, imam_id)
                VALUES (?, ?)
                ON CONFLICT(date_key) DO UPDATE SET imam_id = ?
            `, [dateKey, imamId, imamId]);
        }

        res.json({ success: true, bookingsAdded: dates.length });
    } catch (error) {
        console.error('Error creating bookings:', error);
        res.status(500).json({ error: 'Failed to create bookings' });
    }
});

// Verify imam access code
app.post('/api/auth/verify', async (req, res) => {
    try {
        const { accessCode } = req.body;
        
        if (!accessCode) {
            return res.status(400).json({ error: 'Access code is required' });
        }

        const imam = await getQuery(`
            SELECT 
                id,
                name,
                access_code as accessCode,
                quota,
                (SELECT COUNT(*) FROM bookings WHERE imam_id = imams.id) as booked
            FROM imams
            WHERE access_code = ?
        `, [accessCode]);

        if (!imam) {
            return res.status(401).json({ error: 'Invalid access code' });
        }

        res.json(imam);
    } catch (error) {
        console.error('Error verifying access code:', error);
        res.status(500).json({ error: 'Failed to verify access code' });
    }
});

// Serve the main HTML file
// Note: Rate limiting is not implemented for static files
// For production deployment with high traffic, consider adding rate limiting middleware
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
