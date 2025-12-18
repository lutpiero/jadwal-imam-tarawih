// Data Storage Keys
const STORAGE_KEYS = {
    RAMADHAN_START: 'ramadhanStartDate',
    IMAMS: 'imams',
    BOOKINGS: 'bookings',
    CURRENT_IMAM: 'currentImam'
};

// Global State
let currentImam = null;
let selectedDates = [];

// Utility Functions
function generateAccessCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getFromStorage(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

function saveToStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// Hijri Calendar Functions
function getHijriDate(gregorianDate) {
    // Simple approximation: Hijri year is about 11 days shorter than Gregorian
    // This is a simplified calculation for demonstration
    // In production, use a proper Islamic calendar library
    const hijriStart = new Date('2024-03-11'); // 1 Ramadhan 1445
    const hijriYear = 1446; // Ramadhan 1446
    
    const ramadhanStart = getFromStorage(STORAGE_KEYS.RAMADHAN_START);
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

// View Management
function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.style.display = 'none';
    });
    document.getElementById(viewId).style.display = 'block';
}

function selectRole(role) {
    switch(role) {
        case 'admin':
            showView('adminView');
            loadAdminData();
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
function loadAdminData() {
    // Load Ramadhan start date
    const startDate = getFromStorage(STORAGE_KEYS.RAMADHAN_START);
    if (startDate) {
        document.getElementById('ramadhanStartDate').value = startDate;
    }
    
    // Load Imams list
    renderImamsList();
    renderAdminCalendar();
}

function saveRamadhanDate() {
    const dateInput = document.getElementById('ramadhanStartDate');
    const date = dateInput.value;
    
    if (!date) {
        alert('Please select a date');
        return;
    }
    
    saveToStorage(STORAGE_KEYS.RAMADHAN_START, date);
    
    const successMsg = document.getElementById('dateSuccessMsg');
    successMsg.style.display = 'block';
    setTimeout(() => {
        successMsg.style.display = 'none';
    }, 3000);
}

function addImam() {
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
    
    const accessCode = generateAccessCode();
    const imams = getFromStorage(STORAGE_KEYS.IMAMS) || [];
    
    const newImam = {
        id: Date.now(),
        name: name,
        accessCode: accessCode,
        quota: quota,
        booked: 0
    };
    
    imams.push(newImam);
    saveToStorage(STORAGE_KEYS.IMAMS, imams);
    
    // Show generated code
    document.getElementById('generatedCode').textContent = accessCode;
    document.getElementById('newImamCode').style.display = 'block';
    
    // Clear inputs
    nameInput.value = '';
    quotaInput.value = '3';
    
    // Refresh list
    renderImamsList();
    
    // Hide code after 10 seconds
    setTimeout(() => {
        document.getElementById('newImamCode').style.display = 'none';
    }, 10000);
}

function renderImamsList() {
    const imams = getFromStorage(STORAGE_KEYS.IMAMS) || [];
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
            <td>${getImamBookedCount(imam.id)} days</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteImam(${imam.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function getImamBookedCount(imamId) {
    const bookings = getFromStorage(STORAGE_KEYS.BOOKINGS) || {};
    let count = 0;
    for (let date in bookings) {
        if (bookings[date] === imamId) {
            count++;
        }
    }
    return count;
}

function deleteImam(imamId) {
    if (!confirm('Are you sure you want to delete this Imam? All their bookings will be removed.')) {
        return;
    }
    
    let imams = getFromStorage(STORAGE_KEYS.IMAMS) || [];
    imams = imams.filter(i => i.id !== imamId);
    saveToStorage(STORAGE_KEYS.IMAMS, imams);
    
    // Remove all bookings for this imam
    let bookings = getFromStorage(STORAGE_KEYS.BOOKINGS) || {};
    for (let date in bookings) {
        if (bookings[date] === imamId) {
            delete bookings[date];
        }
    }
    saveToStorage(STORAGE_KEYS.BOOKINGS, bookings);
    
    renderImamsList();
    renderAdminCalendar();
}

// Calendar Rendering
function generate30DaysCalendar() {
    const startDate = getFromStorage(STORAGE_KEYS.RAMADHAN_START);
    if (!startDate) {
        return [];
    }
    
    const days = [];
    const start = new Date(startDate);
    
    for (let i = 0; i < 30; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        
        const hijri = getHijriDate(date);
        
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

function renderAdminCalendar() {
    const container = document.getElementById('adminCalendar');
    const days = generate30DaysCalendar();
    
    if (days.length === 0) {
        container.innerHTML = '<div class="alert alert-warning">Please set Ramadhan starting date in Settings first.</div>';
        return;
    }
    
    const bookings = getFromStorage(STORAGE_KEYS.BOOKINGS) || {};
    const imams = getFromStorage(STORAGE_KEYS.IMAMS) || [];
    
    container.innerHTML = days.map(day => {
        const imamId = bookings[day.dateKey];
        const imam = imams.find(i => i.id === imamId);
        
        return `
            <div class="calendar-day ${imam ? 'booked' : ''}">
                <div class="hijri-date">${day.hijriDay} ${day.hijriMonth}</div>
                <div class="gregorian-date">${day.gregorianDay} ${day.gregorianMonth} ${day.gregorianYear}</div>
                <div class="day-name">${day.dayName}</div>
                ${imam ? `<div class="imam-name">${imam.name}</div>` : '<div class="text-muted mt-2"><small>Available</small></div>'}
            </div>
        `;
    }).join('');
}

// Imam Functions
function verifyAccessCode() {
    const code = document.getElementById('accessCode').value.trim();
    const imams = getFromStorage(STORAGE_KEYS.IMAMS) || [];
    
    const imam = imams.find(i => i.accessCode === code);
    
    if (!imam) {
        const errorDiv = document.getElementById('loginError');
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
        return;
    }
    
    currentImam = imam;
    selectedDates = [];
    
    document.getElementById('imamLogin').style.display = 'none';
    document.getElementById('imamBooking').style.display = 'block';
    document.getElementById('loggedImamName').textContent = imam.name;
    document.getElementById('quotaCount').textContent = imam.quota;
    
    renderImamCalendar();
}

function renderImamCalendar() {
    const container = document.getElementById('imamCalendar');
    const days = generate30DaysCalendar();
    
    if (days.length === 0) {
        container.innerHTML = '<div class="alert alert-warning">Calendar not configured yet. Please contact administrator.</div>';
        return;
    }
    
    const bookings = getFromStorage(STORAGE_KEYS.BOOKINGS) || {};
    
    container.innerHTML = days.map(day => {
        const isBooked = bookings[day.dateKey];
        const isBookedByMe = bookings[day.dateKey] === currentImam.id;
        const isSelected = selectedDates.includes(day.dateKey);
        const canSelect = !isBooked || isBookedByMe;
        
        let classes = 'calendar-day';
        if (canSelect && !isBookedByMe) classes += ' available';
        if (isBooked && !isBookedByMe) classes += ' booked';
        if (isSelected || isBookedByMe) classes += ' selected';
        
        const imams = getFromStorage(STORAGE_KEYS.IMAMS) || [];
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
}

function toggleDateSelection(dateKey) {
    if (!currentImam) return;
    
    // Get current bookings for this imam
    const bookings = getFromStorage(STORAGE_KEYS.BOOKINGS) || {};
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
    
    updateSelectionCount();
    renderImamCalendar();
}

function updateSelectionCount() {
    const bookings = getFromStorage(STORAGE_KEYS.BOOKINGS) || {};
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
}

function saveBookings() {
    if (selectedDates.length === 0) {
        alert('Please select at least one date');
        return;
    }
    
    const bookings = getFromStorage(STORAGE_KEYS.BOOKINGS) || {};
    const currentBookings = Object.keys(bookings).filter(key => bookings[key] === currentImam.id).length;
    const total = currentBookings + selectedDates.length;
    
    if (total !== currentImam.quota) {
        if (!confirm(`You have selected ${total} out of ${currentImam.quota} days. Do you want to save anyway?`)) {
            return;
        }
    }
    
    selectedDates.forEach(dateKey => {
        bookings[dateKey] = currentImam.id;
    });
    
    saveToStorage(STORAGE_KEYS.BOOKINGS, bookings);
    selectedDates = [];
    
    alert('Bookings saved successfully!');
    renderImamCalendar();
    updateSelectionCount();
}

function logout() {
    currentImam = null;
    selectedDates = [];
    document.getElementById('imamLogin').style.display = 'block';
    document.getElementById('imamBooking').style.display = 'none';
    document.getElementById('accessCode').value = '';
}

// Public View Functions
function renderPublicCalendar() {
    const container = document.getElementById('publicCalendar');
    const days = generate30DaysCalendar();
    
    if (days.length === 0) {
        container.innerHTML = '<div class="alert alert-warning">Schedule not available yet.</div>';
        return;
    }
    
    const bookings = getFromStorage(STORAGE_KEYS.BOOKINGS) || {};
    const imams = getFromStorage(STORAGE_KEYS.IMAMS) || [];
    
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
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Show role selection by default
    showView('roleSelectionView');
});
