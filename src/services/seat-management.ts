import { Seat, SeatStatus, MaintenanceInfo, Booking } from '@/types';

// Mock Firebase database
const mockDb = {
  seats: new Map<string, Seat>(),
  bookings: new Map<string, Booking>(),
};

/**
 * Search seats by seat number
 */
export async function searchSeats(query: string): Promise<Seat[]> {
  const allSeats = Array.from(mockDb.seats.values());
  
  if (!query || query.trim() === '') {
    return allSeats;
  }
  
  const normalizedQuery = query.toLowerCase().trim();
  return allSeats.filter(seat => 
    seat.number.toLowerCase().includes(normalizedQuery)
  );
}

/**
 * Filter seats by availability status
 */
export async function filterSeatsByAvailability(
  seats: Seat[],
  showOnlyAvailable: boolean
): Promise<Seat[]> {
  if (!showOnlyAvailable) {
    return seats;
  }
  
  return seats.filter(seat => seat.status === 'available');
}

/**
 * Get all seats with optional filters
 */
export async function getAllSeats(filters?: {
  section?: string;
  floor?: string;
  status?: SeatStatus;
  availableOnly?: boolean;
  searchQuery?: string;
}): Promise<Seat[]> {
  let seats = Array.from(mockDb.seats.values());
  
  // Apply search query
  if (filters?.searchQuery) {
    const normalizedQuery = filters.searchQuery.toLowerCase().trim();
    seats = seats.filter(seat => 
      seat.number.toLowerCase().includes(normalizedQuery)
    );
  }
  
  // Apply section filter
  if (filters?.section) {
    seats = seats.filter(seat => seat.section === filters.section);
  }
  
  // Apply floor filter
  if (filters?.floor) {
    seats = seats.filter(seat => seat.floor === filters.floor);
  }
  
  // Apply status filter
  if (filters?.status) {
    seats = seats.filter(seat => seat.status === filters.status);
  }
  
  // Apply availability filter
  if (filters?.availableOnly) {
    seats = seats.filter(seat => seat.status === 'available');
  }
  
  return seats;
}

/**
 * Mark a seat as under maintenance
 */
export async function markSeatMaintenance(
  seatId: string,
  maintenanceInfo: MaintenanceInfo
): Promise<void> {
  const seat = mockDb.seats.get(seatId);
  
  if (!seat) {
    throw new Error(`Seat ${seatId} not found`);
  }
  
  // Update seat status
  seat.status = 'maintenance';
  seat.maintenanceInfo = maintenanceInfo;
  
  mockDb.seats.set(seatId, seat);
}

/**
 * Mark a seat as out of service and cancel future bookings
 */
export async function markSeatOutOfService(
  seatId: string,
  maintenanceInfo: MaintenanceInfo,
  adminId: string
): Promise<{ cancelledBookings: string[] }> {
  const seat = mockDb.seats.get(seatId);
  
  if (!seat) {
    throw new Error(`Seat ${seatId} not found`);
  }
  
  // Update seat status
  seat.status = 'out-of-service';
  seat.maintenanceInfo = maintenanceInfo;
  mockDb.seats.set(seatId, seat);
  
  // Cancel all future bookings for this seat
  const now = new Date();
  const cancelledBookings: string[] = [];
  
  for (const [bookingId, booking] of mockDb.bookings.entries()) {
    if (booking.seatId === seatId && 
        new Date(booking.startTime) > now &&
        booking.status !== 'cancelled') {
      booking.status = 'cancelled';
      booking.cancelledBy = adminId;
      booking.cancelReason = `Seat marked out of service: ${maintenanceInfo.reason}`;
      booking.updatedAt = new Date().toISOString();
      
      mockDb.bookings.set(bookingId, booking);
      cancelledBookings.push(bookingId);
    }
  }
  
  return { cancelledBookings };
}

/**
 * Restore a seat to service
 */
export async function restoreSeatToService(seatId: string): Promise<void> {
  const seat = mockDb.seats.get(seatId);
  
  if (!seat) {
    throw new Error(`Seat ${seatId} not found`);
  }
  
  // Check if seat is currently occupied
  const hasActiveBooking = seat.bookingId && seat.bookedBy;
  
  if (hasActiveBooking) {
    seat.status = 'occupied';
  } else {
    seat.status = 'available';
  }
  
  // Clear maintenance info
  delete seat.maintenanceInfo;
  
  mockDb.seats.set(seatId, seat);
}

/**
 * Check if a seat can be booked
 */
export async function canBookSeat(seatId: string): Promise<boolean> {
  const seat = mockDb.seats.get(seatId);
  
  if (!seat) {
    return false;
  }
  
  // Seats under maintenance or out of service cannot be booked
  if (seat.status === 'maintenance' || seat.status === 'out-of-service') {
    return false;
  }
  
  // Available seats can be booked
  if (seat.status === 'available') {
    return true;
  }
  
  return false;
}

/**
 * Get seat by ID
 */
export async function getSeatById(seatId: string): Promise<Seat | null> {
  return mockDb.seats.get(seatId) || null;
}

/**
 * Identify user's own bookings in seat list
 */
export async function identifyUserBookings(
  seats: Seat[],
  userId: string
): Promise<Array<Seat & { isUserBooking: boolean }>> {
  return seats.map(seat => ({
    ...seat,
    isUserBooking: seat.bookedBy === userId
  }));
}

// Test utilities
export const __test__ = {
  setSeats: (seats: Seat[]) => {
    mockDb.seats.clear();
    seats.forEach(seat => mockDb.seats.set(seat.id, seat));
  },
  setBookings: (bookings: Booking[]) => {
    mockDb.bookings.clear();
    bookings.forEach(booking => mockDb.bookings.set(booking.id, booking));
  },
  getSeats: () => Array.from(mockDb.seats.values()),
  getBookings: () => Array.from(mockDb.bookings.values()),
  clear: () => {
    mockDb.seats.clear();
    mockDb.bookings.clear();
  },
};
