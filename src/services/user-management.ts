import { ref, get, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import type { UserProfile, Booking, UserStatistics } from '@/types';

/**
 * User Management Service
 * Provides functions for user profile management, statistics, and restrictions
 */

/**
 * Get user profile with stats
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const userRef = ref(db, `users/${userId}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.val() as UserProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Get user booking history
 */
export async function getUserBookingHistory(
  userId: string,
  limit?: number
): Promise<Booking[]> {
  try {
    // Bookings are stored at bookings/{userId}
    const bookingsRef = ref(db, `bookings/${userId}`);
    const snapshot = await get(bookingsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const bookings: Booking[] = [];
    snapshot.forEach((child) => {
      const booking = child.val() as Booking;
      bookings.push({
        ...booking,
        id: child.key!,
      });
    });

    // Sort by booking time (most recent first)
    bookings.sort((a, b) => {
      return new Date(b.bookingTime).getTime() - new Date(a.bookingTime).getTime();
    });

    // Apply limit if specified
    if (limit && limit > 0) {
      return bookings.slice(0, limit);
    }

    return bookings;
  } catch (error) {
    console.error('Error fetching user booking history:', error);
    return [];
  }
}

/**
 * Flag a user (restrict booking privileges)
 */
export async function flagUser(
  userId: string,
  reason: string,
  adminId: string
): Promise<void> {
  try {
    const userRef = ref(db, `users/${userId}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      throw new Error('User not found');
    }

    await update(userRef, {
      restrictions: {
        isFlagged: true,
        reason,
        flaggedBy: adminId,
        flaggedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });

    // Log the action
    await logAdminAction(adminId, 'flag_user', userId, 'user', reason);
  } catch (error) {
    console.error('Error flagging user:', error);
    throw error;
  }
}

/**
 * Remove flag from user (restore booking privileges)
 */
export async function unflagUser(userId: string, adminId: string): Promise<void> {
  try {
    const userRef = ref(db, `users/${userId}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      throw new Error('User not found');
    }

    await update(userRef, {
      restrictions: {
        isFlagged: false,
      },
      updatedAt: new Date().toISOString(),
    });

    // Log the action
    await logAdminAction(adminId, 'unflag_user', userId, 'user', 'Restrictions removed');
  } catch (error) {
    console.error('Error unflagging user:', error);
    throw error;
  }
}

/**
 * Search users by email or name
 */
export async function searchUsers(query: string): Promise<UserProfile[]> {
  try {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      return [];
    }

    const users: UserProfile[] = [];
    const searchLower = query.toLowerCase().trim();

    snapshot.forEach((child) => {
      const user = child.val() as UserProfile;
      const matchesEmail = user.email.toLowerCase().includes(searchLower);
      const matchesName = user.displayName?.toLowerCase().includes(searchLower);

      if (matchesEmail || matchesName) {
        users.push(user);
      }
    });

    return users;
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

/**
 * Get user statistics
 */
export async function getUserStatistics(userId: string): Promise<UserStatistics> {
  try {
    const bookings = await getUserBookingHistory(userId);

    // Filter completed bookings with check-in
    const completedBookings = bookings.filter(
      (b) => b.status === 'completed' && b.entryTime
    );

    // Calculate total hours booked
    const totalHoursBooked = completedBookings.reduce((sum, booking) => {
      const start = new Date(booking.entryTime!);
      const end = new Date(booking.exitTime || booking.endTime);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return sum + Math.max(0, hours);
    }, 0);

    // Calculate average session duration
    const averageSessionDuration =
      completedBookings.length > 0
        ? totalHoursBooked / completedBookings.length
        : 0;

    // Count no-shows and overstays
    const noShowCount = bookings.filter((b) => b.status === 'no-show').length;
    const overstayCount = bookings.filter((b) => {
      if (b.status !== 'completed' || !b.exitTime) return false;
      const exitTime = new Date(b.exitTime);
      const endTime = new Date(b.endTime);
      return exitTime > endTime;
    }).length;

    // Find most booked seats
    const seatCounts: Record<string, number> = {};
    completedBookings.forEach((booking) => {
      seatCounts[booking.seatId] = (seatCounts[booking.seatId] || 0) + 1;
    });

    const mostBookedSeats = Object.entries(seatCounts)
      .map(([seatId, count]) => ({ seatId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Find preferred time slots
    const hourCounts: Record<number, number> = {};
    completedBookings.forEach((booking) => {
      const hour = new Date(booking.startTime).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const preferredTimeSlots = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate weekly usage
    const weeklyUsage = calculateWeeklyUsage(completedBookings);

    // Calculate monthly usage
    const monthlyUsage = calculateMonthlyUsage(completedBookings);

    return {
      totalBookings: bookings.length,
      totalHoursBooked,
      averageSessionDuration,
      noShowCount,
      overstayCount,
      mostBookedSeats,
      preferredTimeSlots,
      weeklyUsage,
      monthlyUsage,
    };
  } catch (error) {
    console.error('Error calculating user statistics:', error);
    return {
      totalBookings: 0,
      totalHoursBooked: 0,
      averageSessionDuration: 0,
      noShowCount: 0,
      overstayCount: 0,
      mostBookedSeats: [],
      preferredTimeSlots: [],
      weeklyUsage: [],
      monthlyUsage: [],
    };
  }
}

/**
 * Calculate weekly usage
 */
function calculateWeeklyUsage(
  bookings: Booking[]
): Array<{ week: string; hours: number }> {
  const weeklyData: Record<string, number> = {};

  bookings.forEach((booking) => {
    if (!booking.entryTime) return;

    const start = new Date(booking.entryTime);
    const end = new Date(booking.exitTime || booking.endTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    // Get week identifier (ISO week)
    const weekStart = getWeekStart(start);
    const weekKey = weekStart.toISOString().split('T')[0];

    weeklyData[weekKey] = (weeklyData[weekKey] || 0) + Math.max(0, hours);
  });

  return Object.entries(weeklyData)
    .map(([week, hours]) => ({ week, hours }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-12); // Last 12 weeks
}

/**
 * Calculate monthly usage
 */
function calculateMonthlyUsage(
  bookings: Booking[]
): Array<{ month: string; hours: number }> {
  const monthlyData: Record<string, number> = {};

  bookings.forEach((booking) => {
    if (!booking.entryTime) return;

    const start = new Date(booking.entryTime);
    const end = new Date(booking.exitTime || booking.endTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    // Get month identifier (YYYY-MM)
    const monthKey = start.toISOString().substring(0, 7);

    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + Math.max(0, hours);
  });

  return Object.entries(monthlyData)
    .map(([month, hours]) => ({ month, hours }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12); // Last 12 months
}

/**
 * Get the start of the week (Monday) for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
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
    const { push, set } = await import('firebase/database');
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
