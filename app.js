// API Configuration
const API_BASE_URL = '';  // Empty for same-origin requests

// Global State
let currentImam = null;
let selectedDates = [];
let cachedSettings = null;
let cachedImams = null;
let cachedBookings = null;
let adminToken = null;
let isAdminAuthenticated = false;

// API Helper Functions
async function apiRequest(endpoint, options = {}) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        // Add admin token if authenticated
        if (adminToken) {
            headers['Authorization'] = `Bearer ${adminToken}`;
        }
        
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            const error = await response.json();
            
            // Handle authentication errors
            if (response.status === 401 && isAdminAuthenticated) {
                console.log('Session expired, logging out');
                adminLogout();
                alert('Your session has expired. Please login again.');
            }
            
            throw new Error(error.error || 'API request failed');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Data Fetching Functions
async function getSettings() {
    if (!cachedSettings) {
        cachedSettings = await apiRequest('/api/settings');
    }
    return cachedSettings;
}

async function getRamadhanStart() {
    const settings = await getSettings();
    return settings.ramadhanStartDate || null;
}

async function saveRamadhanStart(date) {
    await apiRequest('/api/settings/ramadhan-start', {
        method: 'PUT',
        body: JSON.stringify({ date })
    });
    cachedSettings = null; // Invalidate cache
}

async function getImams() {
    if (!cachedImams) {
        cachedImams = await apiRequest('/api/imams');
    }
    return cachedImams;
}

async function createImam(name, quota) {
    const imam = await apiRequest('/api/imams', {
        method: 'POST',
        body: JSON.stringify({ name, quota })
    });
    cachedImams = null; // Invalidate cache
    return imam;
}

async function deleteImamAPI(imamId) {
    await apiRequest(`/api/imams/${imamId}`, {
        method: 'DELETE'
    });
    cachedImams = null; // Invalidate cache
    cachedBookings = null; // Invalidate cache
}

async function getBookings() {
    if (!cachedBookings) {
        cachedBookings = await apiRequest('/api/bookings');
    }
    return cachedBookings;
}

async function saveBookingsAPI(imamId, dates) {
    await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({ imamId, dates })
    });
    cachedBookings = null; // Invalidate cache
}

async function verifyAccessCodeAPI(accessCode) {
    return await apiRequest('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ accessCode })
    });
}

// Hijri Calendar Functions
function getHijriDate(gregorianDate, ramadhanStart) {
    // Simple approximation: Hijri year is about 11 days shorter than Gregorian
    // This is a simplified calculation for demonstration
    // In production, use a proper Islamic calendar library
    const hijriYear = 1446; // Ramadhan 1446
    
    if (!ramadhanStart) {
        return { day: 1, month: 'Ramadhan', year: hijriYear };
    }
    
    const startDate = new Date(ramadhanStart);
    const daysDiff = Math.floor((gregorianDate - startDate) / (1000 * 60 * 60 * 24));
    const hijriDay = daysDiff + 1;
    
    return {
        day: hijriDay,
        month: 'Ramadhan',
        year: hijriYear
    };
}

function formatGregorianDate(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return {
        day: date.getDate(),
        month: months[date.getMonth()],
        year: date.getFullYear(),
        dayName: days[date.getDay()]
    };
}

function getDayName(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
}

// Admin Authentication Functions
async function adminLogin() {
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    
    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }
        
        const data = await response.json();
        
        // Store token in sessionStorage
        adminToken = data.token;
        sessionStorage.setItem('adminToken', data.token);
        sessionStorage.setItem('adminUsername', data.username);
        isAdminAuthenticated = true;
        
        // Hide login form, show dashboard
        document.getElementById('adminLogin').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        document.getElementById('adminLogoutBtn').style.display = 'inline-block';
        
        // Clear password field
        document.getElementById('adminPassword').value = '';
        
        // Load admin data
        await loadAdminData();
    } catch (error) {
        console.error('Admin login error:', error);
        const errorDiv = document.getElementById('adminLoginError');
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

async function adminLogout() {
    if (isAdminAuthenticated && adminToken) {
        try {
            await apiRequest('/api/admin/logout', {
                method: 'POST'
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    // Clear token and state
    adminToken = null;
    isAdminAuthenticated = false;
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUsername');
    
    // Show login form, hide dashboard
    document.getElementById('adminLogin').style.display = 'block';
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('adminLogoutBtn').style.display = 'none';
    
    // Clear form fields
    document.getElementById('adminUsername').value = '';
    document.getElementById('adminPassword').value = '';
}

async function checkAdminSession() {
    const storedToken = sessionStorage.getItem('adminToken');
    
    if (storedToken) {
        adminToken = storedToken;
        
        try {
            await apiRequest('/api/admin/verify');
            isAdminAuthenticated = true;
            
            // Hide login form, show dashboard
            document.getElementById('adminLogin').style.display = 'none';
            document.getElementById('adminDashboard').style.display = 'block';
            document.getElementById('adminLogoutBtn').style.display = 'inline-block';
            
            return true;
        } catch (error) {
            console.log('Stored session invalid');
            adminLogout();
            return false;
        }
    }
    
    return false;
}

// View Management
function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.style.display = 'none';
    });
    document.getElementById(viewId).style.display = 'block';
}

async function selectRole(role) {
    switch(role) {
        case 'admin':
            showView('adminView');
            const hasSession = await checkAdminSession();
            if (hasSession) {
                await loadAdminData();
            }
            break;
        case 'imam':
            showView('imamView');
            break;
        case 'public':
            showView('publicView');
            renderPublicCalendar();
            break;
    }
}

// Admin Functions
async function loadAdminData() {
    try {
        // Load Ramadhan start date
        const startDate = await getRamadhanStart();
        if (startDate) {
            document.getElementById('ramadhanStartDate').value = startDate;
        }
        
        // Load Imams list
        await renderImamsList();
        await renderAdminCalendar();
    } catch (error) {
        console.error('Error loading admin data:', error);
        alert('Failed to load data. Please check if the server is running.');
    }
}

async function saveRamadhanDate() {
    const dateInput = document.getElementById('ramadhanStartDate');
    const date = dateInput.value;
    
    if (!date) {
        alert('Please select a date');
        return;
    }
    
    try {
        await saveRamadhanStart(date);
        
        const successMsg = document.getElementById('dateSuccessMsg');
        successMsg.style.display = 'block';
        setTimeout(() => {
            successMsg.style.display = 'none';
        }, 3000);
    } catch (error) {
        console.error('Error saving date:', error);
        alert('Failed to save date. Please try again.');
    }
}

async function addImam() {
    const nameInput = document.getElementById('imamName');
    const quotaInput = document.getElementById('imamQuota');
    
    const name = nameInput.value.trim();
    const quota = parseInt(quotaInput.value);
    
    if (!name) {
        alert('Please enter Imam name');
        return;
    }
    
    if (quota < 1 || quota > 30) {
        alert('Quota must be between 1 and 30');
        return;
    }
    
    try {
        const newImam = await createImam(name, quota);
        
        // Show generated code
        document.getElementById('generatedCode').textContent = newImam.accessCode;
        document.getElementById('newImamCode').style.display = 'block';
        
        // Clear inputs
        nameInput.value = '';
        quotaInput.value = '3';
        
        // Refresh list
        await renderImamsList();
        
        // Hide code after 10 seconds
        setTimeout(() => {
            document.getElementById('newImamCode').style.display = 'none';
        }, 10000);
    } catch (error) {
        console.error('Error adding imam:', error);
        alert('Failed to add imam. Please try again.');
    }
}

async function renderImamsList() {
    try {
        const imams = await getImams();
        const tbody = document.getElementById('imamsList');
        
        if (imams.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No Imams registered yet</td></tr>';
            return;
        }
        
        tbody.innerHTML = imams.map(imam => `
            <tr>
                <td>${imam.name}</td>
                <td><code>${imam.accessCode}</code></td>
                <td>${imam.quota}</td>
                <td>${imam.booked} days</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteImam(${imam.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error rendering imams list:', error);
    }
}

async function deleteImam(imamId) {
    if (!confirm('Are you sure you want to delete this Imam? All their bookings will be removed.')) {
        return;
    }
    
    try {
        await deleteImamAPI(imamId);
        await renderImamsList();
        await renderAdminCalendar();
    } catch (error) {
        console.error('Error deleting imam:', error);
        alert('Failed to delete imam. Please try again.');
    }
}

// Calendar Rendering
function generate30DaysCalendar(ramadhanStart) {
    if (!ramadhanStart) {
        return [];
    }
    
    const days = [];
    const start = new Date(ramadhanStart);
    
    for (let i = 0; i < 30; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        
        const hijri = getHijriDate(date, ramadhanStart);
        
        days.push({
            gregorianDate: date,
            gregorianDay: date.getDate(),
            gregorianMonth: date.toLocaleDateString('en-US', { month: 'short' }),
            gregorianYear: date.getFullYear(),
            dayName: getDayName(date),
            hijriDay: hijri.day,
            hijriMonth: hijri.month,
            hijriYear: hijri.year,
            dateKey: date.toISOString().split('T')[0]
        });
    }
    
    return days;
}

async function renderAdminCalendar() {
    try {
        const container = document.getElementById('adminCalendar');
        const ramadhanStart = await getRamadhanStart();
        const days = generate30DaysCalendar(ramadhanStart);
        
        if (days.length === 0) {
            container.innerHTML = '<div class="alert alert-warning">Please set Ramadhan starting date in Settings first.</div>';
            return;
        }
        
        const bookings = await getBookings();
        const imams = await getImams();
        
        container.innerHTML = days.map(day => {
            const imamId = bookings[day.dateKey];
            const imam = imams.find(i => i.id === imamId);
            
            // Make booked days clickable for admin
            const bookedClass = imam ? 'booked admin-editable' : '';
            const clickHandler = imam ? `onclick="removeBooking('${day.dateKey}', '${imam.name}', '${day.hijriDay} ${day.hijriMonth}', '${day.gregorianDay} ${day.gregorianMonth} ${day.gregorianYear}')"` : '';
            
            return `
                <div class="calendar-day ${bookedClass}" ${clickHandler}>
                    <div class="hijri-date">${day.hijriDay} ${day.hijriMonth}</div>
                    <div class="gregorian-date">${day.gregorianDay} ${day.gregorianMonth} ${day.gregorianYear}</div>
                    <div class="day-name">${day.dayName}</div>
                    ${imam ? `<div class="imam-name">${imam.name}</div>` : '<div class="text-muted mt-2"><small>Available</small></div>'}
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error rendering admin calendar:', error);
    }
}

async function removeBooking(dateKey, imamName, hijriDate, gregorianDate) {
    if (!isAdminAuthenticated) {
        alert('You must be logged in to remove bookings');
        return;
    }
    
    const message = `Remove ${imamName} from ${hijriDate} (${gregorianDate})?`;
    
    if (!confirm(message)) {
        return;
    }
    
    try {
        await apiRequest(`/api/bookings/${dateKey}`, {
            method: 'DELETE'
        });
        
        // Invalidate caches
        cachedBookings = null;
        cachedImams = null;
        
        // Refresh views
        await renderAdminCalendar();
        await renderImamsList();
        
        // Show success message
        alert('Booking removed successfully!');
    } catch (error) {
        console.error('Error removing booking:', error);
        alert('Failed to remove booking. Please try again.');
    }
}

// Imam Functions
async function verifyAccessCode() {
    const code = document.getElementById('accessCode').value.trim();
    
    try {
        const imam = await verifyAccessCodeAPI(code);
        
        currentImam = imam;
        selectedDates = [];
        
        document.getElementById('imamLogin').style.display = 'none';
        document.getElementById('imamBooking').style.display = 'block';
        document.getElementById('loggedImamName').textContent = imam.name;
        document.getElementById('quotaCount').textContent = imam.quota;
        
        await renderImamCalendar();
    } catch (error) {
        console.error('Error verifying access code:', error);
        const errorDiv = document.getElementById('loginError');
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }
}

async function renderImamCalendar() {
    try {
        const container = document.getElementById('imamCalendar');
        const ramadhanStart = await getRamadhanStart();
        const days = generate30DaysCalendar(ramadhanStart);
        
        if (days.length === 0) {
            container.innerHTML = '<div class="alert alert-warning">Calendar not configured yet. Please contact administrator.</div>';
            return;
        }
        
        const bookings = await getBookings();
        const imams = await getImams();
        
        container.innerHTML = days.map(day => {
            const isBooked = bookings[day.dateKey];
            const isBookedByMe = bookings[day.dateKey] === currentImam.id;
            const isSelected = selectedDates.includes(day.dateKey);
            const canSelect = !isBooked || isBookedByMe;
            
            let classes = 'calendar-day';
            if (canSelect && !isBookedByMe) classes += ' available';
            if (isBooked && !isBookedByMe) classes += ' booked';
            if (isSelected || isBookedByMe) classes += ' selected';
            
            const bookedImam = isBooked ? imams.find(i => i.id === bookings[day.dateKey]) : null;
            
            return `
                <div class="${classes}" onclick="${canSelect ? `toggleDateSelection('${day.dateKey}')` : ''}" 
                     style="${canSelect ? 'cursor: pointer;' : ''}">
                    <div class="hijri-date">${day.hijriDay} ${day.hijriMonth}</div>
                    <div class="gregorian-date">${day.gregorianDay} ${day.gregorianMonth} ${day.gregorianYear}</div>
                    <div class="day-name">${day.dayName}</div>
                    ${isBookedByMe ? '<div class="imam-name">Your Slot</div>' : ''}
                    ${isBooked && !isBookedByMe ? `<div class="text-muted mt-2"><small>Booked by ${bookedImam ? bookedImam.name : 'Other'}</small></div>` : ''}
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error rendering imam calendar:', error);
    }
}

async function toggleDateSelection(dateKey) {
    if (!currentImam) return;
    
    try {
        // Get current bookings for this imam
        const bookings = await getBookings();
        const currentBookings = Object.keys(bookings).filter(key => bookings[key] === currentImam.id);
        
        const index = selectedDates.indexOf(dateKey);
        
        if (index > -1) {
            // Deselect
            selectedDates.splice(index, 1);
        } else {
            // Check if quota is reached
            const totalSelected = selectedDates.length + currentBookings.length;
            if (totalSelected >= currentImam.quota) {
                alert(`You can only book ${currentImam.quota} days maximum.`);
                return;
            }
            selectedDates.push(dateKey);
        }
        
        await updateSelectionCount();
        await renderImamCalendar();
    } catch (error) {
        console.error('Error toggling date selection:', error);
    }
}

async function updateSelectionCount() {
    try {
        const bookings = await getBookings();
        const currentBookings = Object.keys(bookings).filter(key => bookings[key] === currentImam.id).length;
        const total = currentBookings + selectedDates.length;
        
        document.getElementById('selectedCount').textContent = total;
        
        const saveBtn = document.getElementById('saveBookingsBtn');
        if (selectedDates.length > 0 && total === currentImam.quota) {
            saveBtn.disabled = false;
            saveBtn.classList.add('btn-success');
            saveBtn.classList.remove('btn-primary');
        } else if (selectedDates.length > 0) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('btn-success');
            saveBtn.classList.add('btn-primary');
        } else {
            saveBtn.disabled = true;
        }
    } catch (error) {
        console.error('Error updating selection count:', error);
    }
}

async function saveBookings() {
    if (selectedDates.length === 0) {
        alert('Please select at least one date');
        return;
    }
    
    try {
        const bookings = await getBookings();
        const currentBookings = Object.keys(bookings).filter(key => bookings[key] === currentImam.id).length;
        const total = currentBookings + selectedDates.length;
        
        if (total !== currentImam.quota) {
            if (!confirm(`You have selected ${total} out of ${currentImam.quota} days. Do you want to save anyway?`)) {
                return;
            }
        }
        
        await saveBookingsAPI(currentImam.id, selectedDates);
        selectedDates = [];
        
        alert('Bookings saved successfully!');
        await renderImamCalendar();
        await updateSelectionCount();
    } catch (error) {
        console.error('Error saving bookings:', error);
        alert('Failed to save bookings. Please try again.');
    }
}

function logout() {
    currentImam = null;
    selectedDates = [];
    document.getElementById('imamLogin').style.display = 'block';
    document.getElementById('imamBooking').style.display = 'none';
    document.getElementById('accessCode').value = '';
}

// Public View Functions
async function renderPublicCalendar() {
    try {
        const container = document.getElementById('publicCalendar');
        const ramadhanStart = await getRamadhanStart();
        const days = generate30DaysCalendar(ramadhanStart);
        
        if (days.length === 0) {
            container.innerHTML = '<div class="alert alert-warning">Schedule not available yet.</div>';
            return;
        }
        
        const bookings = await getBookings();
        const imams = await getImams();
        
        container.innerHTML = days.map(day => {
            const imamId = bookings[day.dateKey];
            const imam = imams.find(i => i.id === imamId);
            
            return `
                <div class="calendar-day ${imam ? 'booked' : ''}">
                    <div class="hijri-date">${day.hijriDay} ${day.hijriMonth}</div>
                    <div class="gregorian-date">${day.gregorianDay} ${day.gregorianMonth} ${day.gregorianYear}</div>
                    <div class="day-name">${day.dayName}</div>
                    ${imam ? `<div class="imam-name">${imam.name}</div>` : '<div class="text-muted mt-2"><small>TBA</small></div>'}
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error rendering public calendar:', error);
        const container = document.getElementById('publicCalendar');
        container.innerHTML = '<div class="alert alert-danger">Failed to load schedule. Please check if the server is running.</div>';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Show role selection by default
    showView('roleSelectionView');
});
