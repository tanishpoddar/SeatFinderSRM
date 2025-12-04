import { LibrarySettings, OperatingHours, Holiday, BookingRules, Booking } from '@/types';

// Mock Firebase database
const mockDb = {
  settings: null as LibrarySettings | null,
  bookings: new Map<string, Booking>(),
};

/**
 * Get library settings
 */
export async function getLibrarySettings(): Promise<LibrarySettings | null> {
  return mockDb.settings;
}

/**
 * Update library settings
 */
export async function updateLibrarySettings(
  settings: LibrarySettings,
  adminId: string
): Promise<void> {
  settings.updatedBy = adminId;
  settings.updatedAt = new Date().toISOString();
  mockDb.settings = settings;
}

/**
 * Update operating hours
 */
export async function updateOperatingHours(
  operatingHours: OperatingHours,
  adminId: string
): Promise<{ affectedBookings: string[] }> {
  if (!mockDb.settings) {
    throw new Error('Settings not initialized');
  }
  
  const oldHours = mockDb.settings.operatingHours;
  mockDb.settings.operatingHours = operatingHours;
  mockDb.settings.updatedBy = adminId;
  mockDb.settings.updatedAt = new Date().toISOString();
  
  // Find bookings affected by the change
  const affectedBookings: string[] = [];
  
  for (const [bookingId, booking] of mockDb.bookings.entries()) {
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      continue;
    }
    
    const startTime = new Date(booking.startTime);
    const dayOfWeek = startTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    const newHours = operatingHours[dayOfWeek];
    
    if (!newHours || newHours.isClosed) {
      affectedBookings.push(bookingId);
      continue;
    }
    
    // Check if booking time is within new operating hours
    const bookingHour = startTime.getHours();
    const bookingMinute = startTime.getMinutes();
    const bookingTimeStr = `${bookingHour.toString().padStart(2, '0')}:${bookingMinute.toString().padStart(2, '0')}`;
    
    if (bookingTimeStr < newHours.open || bookingTimeStr >= newHours.close) {
      affectedBookings.push(bookingId);
    }
  }
  
  return { affectedBookings };
}

/**
 * Add holiday
 */
export async function addHoliday(
  holiday: Holiday,
  adminId: string
): Promise<void> {
  if (!mockDb.settings) {
    throw new Error('Settings not initialized');
  }
  
  // Check if holiday already exists
  const exists = mockDb.settings.holidays.some(h => h.date === holiday.date);
  
  if (!exists) {
    mockDb.settings.holidays.push(holiday);
    mockDb.settings.updatedBy = adminId;
    mockDb.settings.updatedAt = new Date().toISOString();
  }
}

/**
 * Remove holiday
 */
export async function removeHoliday(
  date: string,
  adminId: string
): Promise<void> {
  if (!mockDb.settings) {
    throw new Error('Settings not initialized');
  }
  
  mockDb.settings.holidays = mockDb.settings.holidays.filter(h => h.date !== date);
  mockDb.settings.updatedBy = adminId;
  mockDb.settings.updatedAt = new Date().toISOString();
}

/**
 * Update booking rules
 */
export async function updateBookingRules(
  rules: BookingRules,
  adminId: string
): Promise<void> {
  if (!mockDb.settings) {
    throw new Error('Settings not initialized');
  }
  
  mockDb.settings.bookingRules = rules;
  mockDb.settings.updatedBy = adminId;
  mockDb.settings.updatedAt = new Date().toISOString();
}

/**
 * Check if a booking time is within operating hours
 */
export async function isWithinOperatingHours(
  bookingTime: Date
): Promise<boolean> {
  if (!mockDb.settings) {
    return true; // No restrictions if settings not configured
  }
  
  const dayOfWeek = bookingTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const hours = mockDb.settings.operatingHours[dayOfWeek];
  
  if (!hours || hours.isClosed) {
    return false;
  }
  
  const bookingHour = bookingTime.getHours();
  const bookingMinute = bookingTime.getMinutes();
  const bookingTimeStr = `${bookingHour.toString().padStart(2, '0')}:${bookingMinute.toString().padStart(2, '0')}`;
  
  return bookingTimeStr >= hours.open && bookingTimeStr < hours.close;
}

/**
 * Check if a date is a holiday
 */
export async function isHoliday(date: Date): Promise<boolean> {
  if (!mockDb.settings) {
    return false;
  }
  
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  return mockDb.settings.holidays.some(h => h.date === dateStr);
}

/**
 * Validate booking against operating hours and holidays
 */
export async function validateBookingTime(
  startTime: Date,
  endTime: Date
): Promise<{ valid: boolean; reason?: string }> {
  // Check if start time is a holiday
  const isHolidayDate = await isHoliday(startTime);
  if (isHolidayDate) {
    return {
      valid: false,
      reason: 'Library is closed on this date (holiday)',
    };
  }
  
  // Check if within operating hours
  const withinHours = await isWithinOperatingHours(startTime);
  if (!withinHours) {
    return {
      valid: false,
      reason: 'Booking time is outside operating hours',
    };
  }
  
  // Check end time as well
  const endWithinHours = await isWithinOperatingHours(endTime);
  if (!endWithinHours) {
    return {
      valid: false,
      reason: 'Booking end time is outside operating hours',
    };
  }
  
  return { valid: true };
}

/**
 * Get available time slots for a given date
 */
export async function getAvailableTimeSlots(
  date: Date,
  slotDuration: number = 60 // minutes
): Promise<Array<{ start: string; end: string }>> {
  // Check if date is a holiday
  const isHolidayDate = await isHoliday(date);
  if (isHolidayDate) {
    return [];
  }
  
  if (!mockDb.settings) {
    return [];
  }
  
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const hours = mockDb.settings.operatingHours[dayOfWeek];
  
  if (!hours || hours.isClosed) {
    return [];
  }
  
  // Parse operating hours
  const [openHour, openMinute] = hours.open.split(':').map(Number);
  const [closeHour, closeMinute] = hours.close.split(':').map(Number);
  
  const slots: Array<{ start: string; end: string }> = [];
  
  let currentTime = new Date(date);
  currentTime.setHours(openHour, openMinute, 0, 0);
  
  const closeTime = new Date(date);
  closeTime.setHours(closeHour, closeMinute, 0, 0);
  
  while (currentTime.getTime() + slotDuration * 60000 <= closeTime.getTime()) {
    const slotStart = new Date(currentTime);
    const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);
    
    slots.push({
      start: `${slotStart.getHours().toString().padStart(2, '0')}:${slotStart.getMinutes().toString().padStart(2, '0')}`,
      end: `${slotEnd.getHours().toString().padStart(2, '0')}:${slotEnd.getMinutes().toString().padStart(2, '0')}`,
    });
    
    currentTime = slotEnd;
  }
  
  return slots;
}

/**
 * Get holidays in a date range
 */
export async function getHolidaysInRange(
  startDate: Date,
  endDate: Date
): Promise<Holiday[]> {
  if (!mockDb.settings) {
    return [];
  }
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  
  return mockDb.settings.holidays.filter(h => h.date >= startStr && h.date <= endStr);
}

// Test utilities
export const __test__ = {
  setSettings: (settings: LibrarySettings | null) => {
    mockDb.settings = settings;
  },
  setBookings: (bookings: Booking[]) => {
    mockDb.bookings.clear();
    bookings.forEach(booking => mockDb.bookings.set(booking.id, booking));
  },
  getSettings: () => mockDb.settings,
  getBookings: () => Array.from(mockDb.bookings.values()),
  clear: () => {
    mockDb.settings = null;
    mockDb.bookings.clear();
  },
};
