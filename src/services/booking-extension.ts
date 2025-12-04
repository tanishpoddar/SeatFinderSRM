import { Booking, Seat, ExtensionResult, LibrarySettings } from '@/types';

// Mock Firebase database
const mockDb = {
  bookings: new Map<string, Booking>(),
  seats: new Map<string, Seat>(),
  settings: null as LibrarySettings | null,
};

/**
 * Check if a booking can be extended for the requested duration
 */
export async function checkExtensionAvailability(
  bookingId: string,
  additionalMinutes: number
): Promise<{ available: boolean; reason?: string }> {
  const booking = mockDb.bookings.get(bookingId);
  
  if (!booking) {
    return { available: false, reason: 'Booking not found' };
  }
  
  if (booking.status !== 'active' && booking.status !== 'pending') {
    return { available: false, reason: 'Booking is not active' };
  }
  
  const seat = mockDb.seats.get(booking.seatId);
  if (!seat) {
    return { available: false, reason: 'Seat not found' };
  }
  
  // Check if seat is available for the extension period
  const currentEndTime = new Date(booking.endTime);
  const newEndTime = new Date(currentEndTime.getTime() + additionalMinutes * 60000);
  
  // Check for conflicting bookings
  const hasConflict = Array.from(mockDb.bookings.values()).some(b => {
    if (b.id === bookingId || b.seatId !== booking.seatId) {
      return false;
    }
    
    if (b.status === 'cancelled' || b.status === 'completed' || b.status === 'no-show') {
      return false;
    }
    
    const bStart = new Date(b.startTime);
    const bEnd = new Date(b.endTime);
    
    // Check if the extension period overlaps with this booking
    return currentEndTime < bEnd && newEndTime > bStart;
  });
  
  if (hasConflict) {
    return { available: false, reason: 'Seat is booked during extension period' };
  }
  
  return { available: true };
}

/**
 * Extend a booking by adding additional minutes
 */
export async function extendBooking(
  bookingId: string,
  additionalMinutes: number
): Promise<ExtensionResult> {
  const booking = mockDb.bookings.get(bookingId);
  
  if (!booking) {
    return {
      success: false,
      message: 'Booking not found',
    };
  }
  
  // Check availability
  const availabilityCheck = await checkExtensionAvailability(bookingId, additionalMinutes);
  
  if (!availabilityCheck.available) {
    // Find alternative seats
    const alternatives = await findAlternativeSeats(booking, additionalMinutes);
    
    return {
      success: false,
      message: availabilityCheck.reason,
      alternatives,
    };
  }
  
  // Update booking end time
  const currentEndTime = new Date(booking.endTime);
  const newEndTime = new Date(currentEndTime.getTime() + additionalMinutes * 60000);
  
  // Store original end time if this is the first extension
  if (!booking.extendedFrom) {
    booking.extendedFrom = booking.endTime;
  }
  
  booking.endTime = newEndTime.toISOString();
  booking.duration += additionalMinutes;
  booking.updatedAt = new Date().toISOString();
  
  mockDb.bookings.set(bookingId, booking);
  
  // Update seat occupied until time
  const seat = mockDb.seats.get(booking.seatId);
  if (seat) {
    seat.occupiedUntil = newEndTime.getTime();
    mockDb.seats.set(booking.seatId, seat);
  }
  
  return {
    success: true,
    newEndTime: newEndTime.toISOString(),
  };
}

/**
 * Check if extension would exceed policy limits
 */
export async function checkPolicyLimits(
  bookingId: string,
  additionalMinutes: number
): Promise<{ allowed: boolean; reason?: string }> {
  const booking = mockDb.bookings.get(bookingId);
  
  if (!booking) {
    return { allowed: false, reason: 'Booking not found' };
  }
  
  const settings = mockDb.settings;
  if (!settings) {
    // No policy limits configured, allow extension
    return { allowed: true };
  }
  
  const newDuration = booking.duration + additionalMinutes;
  
  // Check max booking duration
  if (newDuration > settings.bookingRules.maxBookingDuration) {
    return {
      allowed: false,
      reason: `Extension would exceed maximum booking duration of ${settings.bookingRules.maxBookingDuration} minutes`,
    };
  }
  
  // Check max daily duration
  const bookingDate = new Date(booking.startTime).toDateString();
  const userBookingsToday = Array.from(mockDb.bookings.values()).filter(
    b => b.userId === booking.userId &&
         new Date(b.startTime).toDateString() === bookingDate &&
         (b.status === 'active' || b.status === 'completed' || b.status === 'pending')
  );
  
  const totalDurationToday = userBookingsToday.reduce((sum, b) => sum + b.duration, 0);
  const newTotalDuration = totalDurationToday + additionalMinutes;
  
  if (newTotalDuration > settings.bookingRules.maxDailyDuration) {
    return {
      allowed: false,
      reason: `Extension would exceed maximum daily duration of ${settings.bookingRules.maxDailyDuration} minutes`,
    };
  }
  
  return { allowed: true };
}

/**
 * Extend booking with policy enforcement
 */
export async function extendBookingWithPolicy(
  bookingId: string,
  additionalMinutes: number
): Promise<ExtensionResult> {
  // Check policy limits first
  const policyCheck = await checkPolicyLimits(bookingId, additionalMinutes);
  
  if (!policyCheck.allowed) {
    return {
      success: false,
      message: policyCheck.reason,
    };
  }
  
  // Proceed with normal extension
  return extendBooking(bookingId, additionalMinutes);
}

/**
 * Find alternative seats for the extension period
 */
export async function findAlternativeSeats(
  booking: Booking,
  additionalMinutes: number
): Promise<Seat[]> {
  const currentEndTime = new Date(booking.endTime);
  const newEndTime = new Date(currentEndTime.getTime() + additionalMinutes * 60000);
  
  const alternatives: Seat[] = [];
  
  for (const seat of mockDb.seats.values()) {
    // Skip the current seat
    if (seat.id === booking.seatId) {
      continue;
    }
    
    // Only consider available seats in the same section
    if (seat.status !== 'available') {
      continue;
    }
    
    const currentSeat = mockDb.seats.get(booking.seatId);
    if (currentSeat && seat.section !== currentSeat.section) {
      continue;
    }
    
    // Check if seat is available during the extension period
    const hasConflict = Array.from(mockDb.bookings.values()).some(b => {
      if (b.seatId !== seat.id) {
        return false;
      }
      
      if (b.status === 'cancelled' || b.status === 'completed' || b.status === 'no-show') {
        return false;
      }
      
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      
      return currentEndTime < bEnd && newEndTime > bStart;
    });
    
    if (!hasConflict) {
      alternatives.push(seat);
    }
  }
  
  return alternatives;
}

/**
 * Check if extension request is urgent (within 15 minutes of booking end)
 */
export async function isUrgentExtension(bookingId: string): Promise<boolean> {
  const booking = mockDb.bookings.get(bookingId);
  
  if (!booking) {
    return false;
  }
  
  const endTime = new Date(booking.endTime);
  const now = new Date();
  const minutesUntilEnd = (endTime.getTime() - now.getTime()) / 60000;
  
  return minutesUntilEnd <= 15 && minutesUntilEnd > 0;
}

/**
 * Process extension with priority handling
 */
export async function processExtensionWithPriority(
  bookingId: string,
  additionalMinutes: number
): Promise<ExtensionResult & { priority: 'urgent' | 'standard' }> {
  const isUrgent = await isUrgentExtension(bookingId);
  const result = await extendBookingWithPolicy(bookingId, additionalMinutes);
  
  return {
    ...result,
    priority: isUrgent ? 'urgent' : 'standard',
  };
}

// Test utilities
export const __test__ = {
  setBookings: (bookings: Booking[]) => {
    mockDb.bookings.clear();
    bookings.forEach(booking => mockDb.bookings.set(booking.id, booking));
  },
  setSeats: (seats: Seat[]) => {
    mockDb.seats.clear();
    seats.forEach(seat => mockDb.seats.set(seat.id, seat));
  },
  setSettings: (settings: LibrarySettings | null) => {
    mockDb.settings = settings;
  },
  getBookings: () => Array.from(mockDb.bookings.values()),
  getSeats: () => Array.from(mockDb.seats.values()),
  clear: () => {
    mockDb.bookings.clear();
    mockDb.seats.clear();
    mockDb.settings = null;
  },
};
