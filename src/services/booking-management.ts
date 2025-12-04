import { ref, get, set, update, push } from 'firebase/database';
import { db } from '@/lib/firebase';
import type { Booking, BookingFilters, Seat } from '@/types';

/**
 * Booking Management Service
 * Provides functions for querying, filtering, and managing bookings
 */

/**
 * Get all bookings with optional filters
 */
export async function getAllBookings(
  filters?: BookingFilters
): Promise<Booking[]> {
  try {
    const bookingsRef = ref(db, 'bookings');
    const snapshot = await get(bookingsRef);

    if (!snapshot.exists()) {
      return [];
    }

    let bookings: Booking[] = [];
    snapshot.forEach((child) => {
      bookings.push(child.val() as Booking);
    });

    // Apply filters
    if (filters) {
      bookings = applyFilters(bookings, filters);
    }

    return bookings;
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return [];
  }
}

/**
 * Apply filters to bookings array
 */
function applyFilters(
  bookings: Booking[],
  filters: BookingFilters
): Booking[] {
  let filtered = [...bookings];

  // Filter by user ID
  if (filters.userId) {
    filtered = filtered.filter((b) => b.userId === filters.userId);
  }

  // Filter by seat ID
  if (filters.seatId) {
    filtered = filtered.filter((b) => b.seatId === filters.seatId);
  }

  // Filter by status
  if (filters.status) {
    filtered = filtered.filter((b) => b.status === filters.status);
  }

  // Filter by date range
  if (filters.startDate) {
    filtered = filtered.filter((b) => {
      const bookingDate = new Date(b.startTime);
      return bookingDate >= filters.startDate!;
    });
  }

  if (filters.endDate) {
    filtered = filtered.filter((b) => {
      const bookingDate = new Date(b.startTime);
      return bookingDate <= filters.endDate!;
    });
  }

  // Filter by search term (searches in userName, userEmail, seatId)
  if (filters.searchTerm && filters.searchTerm.trim()) {
    const searchLower = filters.searchTerm.toLowerCase().trim();
    filtered = filtered.filter(
      (b) =>
        b.userName.toLowerCase().includes(searchLower) ||
        b.userEmail.toLowerCase().includes(searchLower) ||
        b.seatId.toLowerCase().includes(searchLower)
    );
  }

  return filtered;
}

/**
 * Get paginated bookings
 */
export async function getPaginatedBookings(
  page: number,
  pageSize: number,
  filters?: BookingFilters
): Promise<{ bookings: Booking[]; total: number; totalPages: number }> {
  const allBookings = await getAllBookings(filters);
  const total = allBookings.length;
  const totalPages = Math.ceil(total / pageSize);

  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const bookings = allBookings.slice(startIndex, endIndex);

  return { bookings, total, totalPages };
}

/**
 * Cancel a booking (admin action)
 */
export async function cancelBooking(
  bookingId: string,
  adminId: string,
  reason: string
): Promise<void> {
  try {
    const bookingRef = ref(db, `bookings/${bookingId}`);
    const snapshot = await get(bookingRef);

    if (!snapshot.exists()) {
      throw new Error('Booking not found');
    }

    const booking = snapshot.val() as Booking;

    // Update booking status
    await update(bookingRef, {
      status: 'cancelled',
      cancelledBy: adminId,
      cancelReason: reason,
      updatedAt: new Date().toISOString(),
    });

    // Release the seat
    const seatRef = ref(db, `seats/${booking.seatId}`);
    await update(seatRef, {
      status: 'available',
      bookedBy: null,
      bookingId: null,
      bookedAt: null,
      occupiedUntil: null,
    });

    // Log the action
    await logAdminAction(adminId, 'cancel_booking', bookingId, 'booking', reason, {
      userId: booking.userId,
      seatId: booking.seatId,
    });

    // TODO: Send notification to user
    // TODO: Send notification to user about cancellation
  } catch (error) {
    console.error('Error cancelling booking:', error);
    throw error;
  }
}

/**
 * Manually assign a seat to a user
 */
export async function manuallyAssignSeat(
  seatId: string,
  userId: string,
  userName: string,
  userEmail: string,
  startTime: Date,
  endTime: Date,
  adminId: string
): Promise<Booking> {
  try {
    // Check if seat is available
    const seatRef = ref(db, `seats/${seatId}`);
    const seatSnapshot = await get(seatRef);

    if (!seatSnapshot.exists()) {
      throw new Error('Seat not found');
    }

    const seat = seatSnapshot.val() as Seat;
    if (seat.status !== 'available') {
      throw new Error('Seat is not available');
    }

    // Create booking
    const bookingsRef = ref(db, 'bookings');
    const newBookingRef = push(bookingsRef);
    const bookingId = newBookingRef.key!;

    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

    const booking: Booking = {
      id: bookingId,
      seatId,
      userId,
      userName,
      userEmail,
      bookingTime: new Date().toISOString(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: 'pending',
      duration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await set(newBookingRef, booking);

    // Update seat status
    await update(seatRef, {
      status: 'reserved',
      bookedBy: userId,
      bookingId,
      bookedAt: Date.now(),
      occupiedUntil: endTime.getTime(),
    });

    // Log the action
    await logAdminAction(
      adminId,
      'manual_assign',
      bookingId,
      'booking',
      'Manual seat assignment',
      { userId, seatId, startTime: startTime.toISOString(), endTime: endTime.toISOString() }
    );

    return booking;
  } catch (error) {
    console.error('Error manually assigning seat:', error);
    throw error;
  }
}

/**
 * Override a booking
 */
export async function overrideBooking(
  bookingId: string,
  changes: Partial<Booking>,
  adminId: string,
  reason: string
): Promise<void> {
  try {
    const bookingRef = ref(db, `bookings/${bookingId}`);
    const snapshot = await get(bookingRef);

    if (!snapshot.exists()) {
      throw new Error('Booking not found');
    }

    // Update booking with changes
    await update(bookingRef, {
      ...changes,
      updatedAt: new Date().toISOString(),
    });

    // Log the action
    await logAdminAction(adminId, 'override_booking', bookingId, 'booking', reason, changes);
  } catch (error) {
    console.error('Error overriding booking:', error);
    throw error;
  }
}

/**
 * Manual check-in
 */
export async function manualCheckIn(
  bookingId: string,
  adminId: string,
  reason: string
): Promise<void> {
  try {
    const bookingRef = ref(db, `bookings/${bookingId}`);
    const snapshot = await get(bookingRef);

    if (!snapshot.exists()) {
      throw new Error('Booking not found');
    }

    const booking = snapshot.val() as Booking;

    // Update booking status
    await update(bookingRef, {
      status: 'active',
      entryTime: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Update seat status
    const seatRef = ref(db, `seats/${booking.seatId}`);
    await update(seatRef, {
      status: 'occupied',
    });

    // Log the action
    await logAdminAction(adminId, 'manual_checkin', bookingId, 'booking', reason, {
      userId: booking.userId,
      seatId: booking.seatId,
    });

    // TODO: Send notification to user
    // TODO: Send notification to user about check-in
  } catch (error) {
    console.error('Error performing manual check-in:', error);
    throw error;
  }
}

/**
 * Manual check-out
 */
export async function manualCheckOut(
  bookingId: string,
  adminId: string,
  reason: string
): Promise<void> {
  try {
    const bookingRef = ref(db, `bookings/${bookingId}`);
    const snapshot = await get(bookingRef);

    if (!snapshot.exists()) {
      throw new Error('Booking not found');
    }

    const booking = snapshot.val() as Booking;

    // Update booking status
    await update(bookingRef, {
      status: 'completed',
      exitTime: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Release the seat
    const seatRef = ref(db, `seats/${booking.seatId}`);
    await update(seatRef, {
      status: 'available',
      bookedBy: null,
      bookingId: null,
      bookedAt: null,
      occupiedUntil: null,
    });

    // Log the action
    await logAdminAction(adminId, 'manual_checkout', bookingId, 'booking', reason, {
      userId: booking.userId,
      seatId: booking.seatId,
    });

    // TODO: Send notification to user
    // TODO: Send notification to user about check-out
  } catch (error) {
    console.error('Error performing manual check-out:', error);
    throw error;
  }
}

/**
 * Log admin action to audit log
 */
async function logAdminAction(
  adminId: string,
  action: string,
  targetId: string,
  targetType: 'booking' | 'user' | 'seat' | 'settings',
  reason?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    const auditLogsRef = ref(db, 'auditLogs');
    const newLogRef = push(auditLogsRef);

    const log = {
      id: newLogRef.key,
      timestamp: new Date().toISOString(),
      adminId,
      adminName: 'Admin', // TODO: Get actual admin name
      action,
      targetId,
      targetType,
      reason,
      details,
    };

    await set(newLogRef, log);
  } catch (error) {
    console.error('Error logging admin action:', error);
    // Don't throw - logging failure shouldn't block the main operation
  }
}
