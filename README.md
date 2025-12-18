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
- A modern web browser (Chrome, Firefox, Safari, Edge)
- No server or installation needed!

### Running the Application

1. **Simple Method**: Open `index.html` directly in your web browser

2. **Local Server Method** (recommended for testing):
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Then open http://localhost:8000 in your browser
   ```

3. **Using Node.js**:
   ```bash
   npx http-server
   ```

## Usage Guide

### For Administrators

1. Click on the **Admin** card on the home page
2. Go to **Settings** tab and set the Ramadhan starting date
3. Switch to **Manage Imams** tab
4. Add Imams by entering their name and quota
5. Share the generated access code with each Imam
6. View the schedule in the **View Schedule** tab

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

- **Technology**: Pure HTML, CSS, and JavaScript
- **Framework**: Bootstrap 5
- **Storage**: Browser localStorage (no backend needed)
- **Responsive**: Works on desktop, tablet, and mobile devices
- **Offline**: Fully functional without internet after initial load

## Data Storage

All data is stored locally in your browser using localStorage:
- Ramadhan starting date
- Imam information (names, access codes, quotas)
- Booking assignments

**Note**: Clearing your browser data will erase all scheduling information.

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Security

- Access codes provide basic authentication for Imams
- All data stored locally in browser
- No server-side components
- No external dependencies (except Bootstrap CDN)

## License

Open source project for Islamic community scheduling needs.

## Support

For issues or questions, please open an issue on the GitHub repository.
