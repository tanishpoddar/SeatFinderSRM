import { ref, get, query, orderByChild, startAt, endAt } from 'firebase/database';
import { db } from '@/lib/firebase';
import type { 
  AnalyticsData, 
  UsageTrend, 
  Booking, 
  Seat,
  PeakHour 
} from '@/types';

/**
 * Analytics Service
 * Provides functions for computing occupancy rates, peak hours, and usage statistics
 */

/**
 * Compute comprehensive analytics for a date range
 */
export async function computeAnalytics(
  startDate: Date,
  endDate: Date
): Promise<AnalyticsData> {
  const bookings = await getBookingsInRange(startDate, endDate);
  const seats = await getAllSeats();

  const occupancyRate = calculateOccupancyRate(bookings, seats, startDate, endDate);
  const peakHours = calculatePeakHours(bookings);
  const averageDuration = calculateAverageDuration(bookings);
  const noShowRate = calculateNoShowRate(bookings);

  const activeBookings = bookings.filter(b => b.status === 'active').length;
  const completedBookings = bookings.filter(b => b.status === 'completed').length;

  return {
    occupancyRate,
    peakHours,
    averageDuration,
    noShowRate,
    totalBookings: bookings.length,
    activeBookings,
    completedBookings,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
  };
}

/**
 * Get usage trends over time with specified granularity
 */
export async function getUsageTrends(
  startDate: Date,
  endDate: Date,
  granularity: 'daily' | 'weekly' | 'monthly'
): Promise<UsageTrend[]> {
  const bookings = await getBookingsInRange(startDate, endDate);
  const seats = await getAllSeats();

  const trends: UsageTrend[] = [];
  const periods = generateTimePeriods(startDate, endDate, granularity);

  for (const period of periods) {
    const periodBookings = bookings.filter(b => {
      const bookingDate = new Date(b.startTime);
      return bookingDate >= period.start && bookingDate < period.end;
    });

    const occupancyRate = calculateOccupancyRate(
      periodBookings,
      seats,
      period.start,
      period.end
    );
    const averageDuration = calculateAverageDuration(periodBookings);

    trends.push({
      date: period.label,
      bookings: periodBookings.length,
      occupancyRate,
      averageDuration,
    });
  }

  return trends;
}

/**
 * Get peak hours for a specific date range
 */
export async function getPeakHours(
  startDate: Date,
  endDate: Date
): Promise<PeakHour[]> {
  const bookings = await getBookingsInRange(startDate, endDate);
  return calculatePeakHours(bookings);
}

/**
 * Calculate no-show rate for a date range
 */
export async function calculateNoShowRateForRange(
  startDate: Date,
  endDate: Date
): Promise<number> {
  const bookings = await getBookingsInRange(startDate, endDate);
  return calculateNoShowRate(bookings);
}

/**
 * Get current occupancy snapshot
 */
export async function getCurrentOccupancy(): Promise<{
  occupied: number;
  total: number;
  rate: number;
}> {
  const seats = await getAllSeats();
  const total = seats.length;
  const occupied = seats.filter(
    s => s.status === 'occupied' || s.status === 'reserved'
  ).length;
  const rate = total > 0 ? (occupied / total) * 100 : 0;

  return { occupied, total, rate };
}

// Helper Functions

/**
 * Fetch all bookings within a date range
 */
async function getBookingsInRange(
  startDate: Date,
  endDate: Date
): Promise<Booking[]> {
  try {
    const bookingsRef = ref(db, 'bookings');
    const snapshot = await get(bookingsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const allBookings: Booking[] = [];
    snapshot.forEach((child) => {
      const booking = child.val() as Booking;
      const bookingDate = new Date(booking.startTime);
      
      if (bookingDate >= startDate && bookingDate <= endDate) {
        allBookings.push(booking);
      }
    });

    return allBookings;
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return [];
  }
}

/**
 * Fetch all seats
 */
async function getAllSeats(): Promise<Seat[]> {
  try {
    const seatsRef = ref(db, 'seats');
    const snapshot = await get(seatsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const seats: Seat[] = [];
    snapshot.forEach((child) => {
      seats.push(child.val() as Seat);
    });

    return seats;
  } catch (error) {
    console.error('Error fetching seats:', error);
    return [];
  }
}

/**
 * Calculate occupancy rate
 * Formula: (total occupied hours / total available hours) * 100
 */
function calculateOccupancyRate(
  bookings: Booking[],
  seats: Seat[],
  startDate: Date,
  endDate: Date
): number {
  if (seats.length === 0 || bookings.length === 0) return 0;

  const totalHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  if (totalHours <= 0) return 0;
  
  const totalAvailableHours = totalHours * seats.length;

  const totalOccupiedMinutes = bookings
    .filter(b => b.status === 'completed' || b.status === 'active')
    .reduce((sum, booking) => {
      const start = new Date(booking.startTime);
      const end = booking.exitTime 
        ? new Date(booking.exitTime) 
        : new Date(booking.endTime);
      
      // Clamp duration to the date range
      const clampedStart = start < startDate ? startDate : start;
      const clampedEnd = end > endDate ? endDate : end;
      
      if (clampedEnd <= clampedStart) return sum;
      
      const duration = (clampedEnd.getTime() - clampedStart.getTime()) / (1000 * 60);
      return sum + Math.max(0, duration);
    }, 0);

  const totalOccupiedHours = totalOccupiedMinutes / 60;

  const rate = totalAvailableHours > 0 
    ? (totalOccupiedHours / totalAvailableHours) * 100 
    : 0;
  
  // Ensure rate is between 0 and 100
  return Math.min(100, Math.max(0, rate));
}

/**
 * Calculate peak hours from bookings
 * Returns top 3 busiest hours
 */
function calculatePeakHours(bookings: Booking[]): PeakHour[] {
  const hourCounts: Record<number, number> = {};

  // Count bookings per hour
  bookings.forEach(booking => {
    const startHour = new Date(booking.startTime).getHours();
    hourCounts[startHour] = (hourCounts[startHour] || 0) + 1;
  });

  // Convert to array and sort by count
  const peakHours: PeakHour[] = Object.entries(hourCounts)
    .map(([hour, count]) => ({
      hour: parseInt(hour),
      count,
      percentage: bookings.length > 0 ? (count / bookings.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3); // Top 3 peak hours

  return peakHours;
}

/**
 * Calculate average duration of bookings in minutes
 */
function calculateAverageDuration(bookings: Booking[]): number {
  const completedBookings = bookings.filter(
    b => b.status === 'completed' && b.exitTime
  );

  if (completedBookings.length === 0) return 0;

  const totalDuration = completedBookings.reduce((sum, booking) => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.exitTime!);
    const duration = (end.getTime() - start.getTime()) / (1000 * 60);
    return sum + Math.max(0, duration); // Ensure non-negative
  }, 0);

  const average = totalDuration / completedBookings.length;
  return Math.max(0, average); // Ensure result is non-negative
}

/**
 * Calculate no-show rate
 * Formula: (no-show bookings / total bookings) * 100
 */
function calculateNoShowRate(bookings: Booking[]): number {
  if (bookings.length === 0) return 0;

  const noShowCount = bookings.filter(b => b.status === 'no-show').length;
  return (noShowCount / bookings.length) * 100;
}

/**
 * Generate time periods for trend analysis
 */
function generateTimePeriods(
  startDate: Date,
  endDate: Date,
  granularity: 'daily' | 'weekly' | 'monthly'
): Array<{ start: Date; end: Date; label: string }> {
  const periods: Array<{ start: Date; end: Date; label: string }> = [];
  const current = new Date(startDate);

  while (current < endDate) {
    const periodStart = new Date(current);
    let periodEnd: Date;
    let label: string;

    switch (granularity) {
      case 'daily':
        periodEnd = new Date(current);
        periodEnd.setDate(periodEnd.getDate() + 1);
        label = periodStart.toISOString().split('T')[0];
        break;

      case 'weekly':
        periodEnd = new Date(current);
        periodEnd.setDate(periodEnd.getDate() + 7);
        label = `Week of ${periodStart.toISOString().split('T')[0]}`;
        break;

      case 'monthly':
        periodEnd = new Date(current);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        label = periodStart.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long' 
        });
        break;
    }

    // Don't exceed end date
    if (periodEnd > endDate) {
      periodEnd = new Date(endDate);
    }

    periods.push({ start: periodStart, end: periodEnd, label });
    current.setTime(periodEnd.getTime());
  }

  return periods;
}
