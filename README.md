# Jadwal Imam Tarawih

Imam Tarawih Scheduling Application - A modern web application for managing and scheduling Imams during Ramadhan Tarawih prayers.

## Features

### 🔐 Three User Roles

#### Admin
- Set Ramadhan starting date (Gregorian calendar)
- Add Imams with custom quotas (1-30 days)
- Generate secure 6-digit access codes
- View all registered Imams and their bookings
- Delete Imams and their schedules
- View complete 30-day schedule

#### Imam
- Login with personal access code
- View available dates in 30-day calendar
- Book dates up to assigned quota
- Visual feedback for selected dates
- Save bookings with confirmation
- View own scheduled dates

#### Public
- View complete Ramadhan Tarawih schedule
- See Imam assignments for each day
- Display both Hijri and Gregorian dates
- Read-only access

### 📅 Calendar Features
- 30-day Ramadhan calendar (Hijri calendar: 1-30 Ramadhan 1446H)
- Dual date display: Hijri and Gregorian
- Day names for easy reference
- Color-coded status indicators
- Responsive grid layout

## Getting Started

### Requirements
- Node.js (version 14 or higher)
- npm (comes with Node.js)
- A modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone or download the repository**

2. **Install dependencies**:
   ```bash
   npm install
   ```

### Running the Application

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Access the application**:
   - Open your browser and navigate to `http://localhost:8000`
   - The server will automatically create the SQLite database on first run

3. **Development mode**:
   ```bash
   npm run dev
   ```

The server will:
- Serve the application on port 8000 (configurable via PORT environment variable)
- Create a `jadwal-imam.db` SQLite database file
- Initialize database tables automatically
- Provide REST API endpoints for data persistence

## Usage Guide

### For Administrators

1. Click on the **Admin** card on the home page
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin123`
   - (Please change these credentials in production)
3. Go to **Settings** tab and set the Ramadhan starting date
4. Switch to **Manage Imams** tab
5. Add Imams by entering their name and quota
6. Share the generated access code with each Imam
7. View the schedule in the **View Schedule** tab
8. Click on booked days in the schedule to remove bookings if needed

### For Imams

1. Click on the **Imam** card on the home page
2. Enter your 6-digit access code
3. Click on available dates to select them
4. Select dates up to your assigned quota
5. Click **Save Bookings** to confirm your schedule

### For Public

1. Click on the **Public** card on the home page
2. View the complete Ramadhan Tarawih schedule
3. See which Imam is assigned to each date

## Technical Details

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite3
- **API**: RESTful endpoints
- **CORS**: Enabled for development

### Frontend
- **Technology**: HTML, CSS, and JavaScript
- **UI Framework**: Bootstrap 5
- **Icons**: Bootstrap Icons
- **Responsive**: Works on desktop, tablet, and mobile devices

### Database Schema

**Settings Table**:
- `key`: Setting key (TEXT, PRIMARY KEY)
- `value`: Setting value (TEXT)
- `updated_at`: Timestamp (DATETIME)

**Imams Table**:
- `id`: Unique identifier (INTEGER, AUTO INCREMENT)
- `name`: Imam name (TEXT)
- `access_code`: 6-digit access code (TEXT, UNIQUE)
- `quota`: Number of days allowed (INTEGER)
- `created_at`: Timestamp (DATETIME)

**Bookings Table**:
- `id`: Unique identifier (INTEGER, AUTO INCREMENT)
- `date_key`: Date in ISO format (TEXT, UNIQUE)
- `imam_id`: Foreign key to imams table (INTEGER)
- `created_at`: Timestamp (DATETIME)

## Data Storage

All data is stored persistently in the SQLite database (`jadwal-imam.db`):
- Ramadhan starting date
- Imam information (names, access codes, quotas)
- Booking assignments

**Note**: Data persists across server restarts and browser sessions. Back up the `jadwal-imam.db` file to preserve your data.

## API Endpoints

### Settings
- `GET /api/settings` - Get all settings
- `PUT /api/settings/ramadhan-start` - Update Ramadhan start date

### Imams
- `GET /api/imams` - Get all imams
- `POST /api/imams` - Create new imam
- `DELETE /api/imams/:id` - Delete imam and their bookings

### Bookings
- `GET /api/bookings` - Get all bookings
- `POST /api/bookings` - Create/update bookings for an imam

### Authentication
- `POST /api/auth/verify` - Verify imam access code

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Security

- Access codes provide authentication for Imams
- All data stored persistently in SQLite database
- RESTful API with proper error handling
- Static file serving restricted to necessary files only
- No external dependencies (except Bootstrap CDN for UI)

### Production Deployment Considerations

For production deployment with high traffic, consider adding:
- Rate limiting middleware (e.g., express-rate-limit)
- HTTPS/TLS encryption
- Environment-based configuration
- Database backups and monitoring
- Input validation and sanitization enhancements

## License

Open source project for Islamic community scheduling needs.

## Support

For issues or questions, please open an issue on the GitHub repository.
