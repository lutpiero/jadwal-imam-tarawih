const express = require('express');
const cors = require('cors');
const path = require('path');
const { runQuery, getQuery, allQuery } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// API Routes

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

// Update Ramadhan start date
app.put('/api/settings/ramadhan-start', async (req, res) => {
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

// Create new imam
app.post('/api/imams', async (req, res) => {
    try {
        const { name, quota } = req.body;
        
        if (!name || !quota) {
            return res.status(400).json({ error: 'Name and quota are required' });
        }

        if (quota < 1 || quota > 30) {
            return res.status(400).json({ error: 'Quota must be between 1 and 30' });
        }

        // Generate unique 6-digit access code
        let accessCode;
        let isUnique = false;
        
        while (!isUnique) {
            accessCode = Math.floor(100000 + Math.random() * 900000).toString();
            const existing = await getQuery('SELECT id FROM imams WHERE access_code = ?', [accessCode]);
            if (!existing) {
                isUnique = true;
            }
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

// Delete imam and their bookings
app.delete('/api/imams/:id', async (req, res) => {
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

        // Delete bookings first (due to foreign key)
        await runQuery('DELETE FROM bookings WHERE imam_id = ?', [imamId]);
        
        // Delete imam
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
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
