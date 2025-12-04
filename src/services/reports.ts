import type { ReportConfig, ReportData, ReportFormat, Booking, Seat } from '@/types';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';

/**
 * Report Service
 * Provides functions for generating and exporting custom reports
 */

/**
 * Generate custom report based on configuration
 */
export async function generateReport(config: ReportConfig): Promise<ReportData> {
  try {
    // Fetch bookings within date range
    const bookings = await getBookingsInRange(config.dateRange.start, config.dateRange.end);
    
    // Fetch seats for occupancy calculations
    const seats = await getAllSeats();

    // Apply filters
    let filteredBookings = bookings;
    if (config.filters?.section) {
      const seatsBySection = seats.filter(s => s.section === config.filters?.section);
      const seatIds = new Set(seatsBySection.map(s => s.id));
      filteredBookings = filteredBookings.filter(b => seatIds.has(b.seatId));
    }

    // Calculate metrics
    const summary: Record<string, number | string> = {};
    const data: Array<Record<string, any>> = [];

    config.metrics.forEach(metric => {
      switch (metric) {
        case 'occupancy':
          summary['Occupancy Rate (%)'] = calculateOccupancyRate(
            filteredBookings,
            seats,
            config.dateRange.start,
            config.dateRange.end
          );
          break;

        case 'no-show-rate':
          summary['No-Show Rate (%)'] = calculateNoShowRate(filteredBookings);
          break;

        case 'average-duration':
          summary['Average Duration (hours)'] = calculateAverageDuration(filteredBookings);
          break;

        case 'user-activity':
          summary['Total Bookings'] = filteredBookings.length;
          summary['Active Users'] = new Set(filteredBookings.map(b => b.userId)).size;
          break;
      }
    });

    // Group data if requested
    if (config.groupBy) {
      const grouped = groupBookings(filteredBookings, config.groupBy);
      data.push(...grouped);
    } else {
      // Return raw booking data
      data.push(...filteredBookings.map(b => ({
        'Booking ID': b.id,
        'User': b.userName,
        'Seat': b.seatId,
        'Start Time': b.startTime,
        'End Time': b.endTime,
        'Status': b.status,
        'Duration (min)': b.duration,
      })));
    }

    return {
      title: `Report: ${config.metrics.join(', ')}`,
      generatedAt: new Date().toISOString(),
      dateRange: {
        start: config.dateRange.start.toISOString(),
        end: config.dateRange.end.toISOString(),
      },
      summary,
      data,
    };
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
}

/**
 * Export report to specified format
 */
export async function exportReport(
  reportData: ReportData,
  format: ReportFormat
): Promise<Blob> {
  try {
    switch (format) {
      case 'csv':
        return exportToCSV(reportData);
      
      case 'pdf':
        return exportToPDF(reportData);
      
      case 'excel':
        return exportToExcel(reportData);
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  } catch (error) {
    console.error('Error exporting report:', error);
    throw error;
  }
}

// Helper Functions

/**
 * Fetch bookings within date range
 */
async function getBookingsInRange(startDate: Date, endDate: Date): Promise<Booking[]> {
  try {
    const bookingsRef = ref(db, 'bookings');
    const snapshot = await get(bookingsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const bookings: Booking[] = [];
    snapshot.forEach((child) => {
      const booking = child.val() as Booking;
      const bookingDate = new Date(booking.startTime);
      
      if (bookingDate >= startDate && bookingDate <= endDate) {
        bookings.push(booking);
      }
    });

    return bookings;
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
  
  return Math.min(100, Math.max(0, Math.round(rate * 100) / 100));
}

/**
 * Calculate no-show rate
 */
function calculateNoShowRate(bookings: Booking[]): number {
  if (bookings.length === 0) return 0;
  const noShowCount = bookings.filter(b => b.status === 'no-show').length;
  return Math.round((noShowCount / bookings.length) * 10000) / 100;
}

/**
 * Calculate average duration
 */
function calculateAverageDuration(bookings: Booking[]): number {
  const completedBookings = bookings.filter(
    b => b.status === 'completed' && b.exitTime
  );

  if (completedBookings.length === 0) return 0;

  const totalDuration = completedBookings.reduce((sum, booking) => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.exitTime!);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return sum + Math.max(0, hours);
  }, 0);

  return Math.round((totalDuration / completedBookings.length) * 100) / 100;
}

/**
 * Group bookings by time period
 */
function groupBookings(
  bookings: Booking[],
  groupBy: 'day' | 'week' | 'month'
): Array<Record<string, any>> {
  const grouped: Record<string, Booking[]> = {};

  bookings.forEach(booking => {
    const date = new Date(booking.startTime);
    let key: string;

    switch (groupBy) {
      case 'day':
        key = date.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = getWeekStart(date);
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        key = date.toISOString().substring(0, 7);
        break;
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(booking);
  });

  return Object.entries(grouped)
    .map(([period, periodBookings]) => ({
      Period: period,
      'Total Bookings': periodBookings.length,
      'Completed': periodBookings.filter(b => b.status === 'completed').length,
      'No-Shows': periodBookings.filter(b => b.status === 'no-show').length,
      'Cancelled': periodBookings.filter(b => b.status === 'cancelled').length,
    }))
    .sort((a, b) => a.Period.localeCompare(b.Period));
}

/**
 * Get week start date (Monday)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * Export to CSV format
 */
function exportToCSV(reportData: ReportData): Blob {
  let csv = `${reportData.title}\n`;
  csv += `Generated: ${reportData.generatedAt}\n`;
  csv += `Date Range: ${reportData.dateRange.start} to ${reportData.dateRange.end}\n\n`;

  // Summary section
  csv += 'Summary\n';
  Object.entries(reportData.summary).forEach(([key, value]) => {
    csv += `${key},${value}\n`;
  });
  csv += '\n';

  // Data section
  if (reportData.data.length > 0) {
    const headers = Object.keys(reportData.data[0]);
    csv += headers.join(',') + '\n';

    reportData.data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csv += values.join(',') + '\n';
    });
  }

  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Export to PDF format (simplified - would use a library like jsPDF in production)
 */
function exportToPDF(reportData: ReportData): Blob {
  // This is a placeholder - in production, use jsPDF or similar
  const content = JSON.stringify(reportData, null, 2);
  return new Blob([content], { type: 'application/pdf' });
}

/**
 * Export to Excel format (simplified - would use a library like xlsx in production)
 */
function exportToExcel(reportData: ReportData): Blob {
  // This is a placeholder - in production, use xlsx or similar
  const content = JSON.stringify(reportData, null, 2);
  return new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
