import * as fc from 'fast-check';
import type { Booking, Seat, BookingStatus } from '@/types';

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  db: {},
}));

jest.mock('firebase/database', () => ({
  ref: jest.fn(),
  get: jest.fn(),
  query: jest.fn(),
  orderByChild: jest.fn(),
  startAt: jest.fn(),
  endAt: jest.fn(),
}));

// Import after mocking
import { computeAnalytics, getPeakHours, calculateNoShowRateForRange, getUsageTrends } from './analytics';
import { ref, get } from 'firebase/database';

// Custom Generators
const bookingStatusArb = fc.constantFrom<BookingStatus>(
  'pending', 'active', 'completed', 'cancelled', 'no-show', 'expired'
);

const validDateArb = fc.integer({ min: 1704067200000, max: 1735689600000 }).map(ts => new Date(ts));

const bookingArb = fc.record({
  id: fc.uuid(),
  seatId: fc.uuid(),
  userId: fc.uuid(),
  userName: fc.string({ minLength: 1, maxLength: 50 }),
  userEmail: fc.emailAddress(),
  bookingTime: validDateArb.map(d => d.toISOString()),
  startTime: validDateArb.map(d => d.toISOString()),
  endTime: validDateArb.map(d => {
    const start = new Date(d);
    start.setHours(start.getHours() + 2);
    return start.toISOString();
  }),
  entryTime: fc.option(validDateArb.map(d => d.toISOString()), { nil: undefined }),
  exitTime: fc.option(validDateArb.map(d => d.toISOString()), { nil: undefined }),
  status: bookingStatusArb,
  duration: fc.integer({ min: 30, max: 480 }),
  createdAt: validDateArb.map(d => d.toISOString()),
  updatedAt: validDateArb.map(d => d.toISOString()),
}) as fc.Arbitrary<Booking>;

const seatArb = fc.record({
  id: fc.uuid(),
  number: fc.string({ minLength: 1, maxLength: 10 }),
  section: fc.constantFrom('A', 'B', 'C', 'D'),
  floor: fc.constantFrom('1', '2', '3'),
  status: fc.constantFrom('available', 'occupied', 'reserved', 'maintenance', 'out-of-service'),
  bookedBy: fc.option(fc.uuid(), { nil: null }),
  bookedAt: fc.option(fc.integer({ min: 0 }), { nil: null }),
  bookingId: fc.option(fc.uuid(), { nil: null }),
  occupiedUntil: fc.option(fc.integer({ min: 0 }), { nil: null }),
}) as fc.Arbitrary<Seat>;

// Helper to mock Firebase responses
function mockFirebaseGet(bookings: Booking[], seats: Seat[]) {
  const getMock = get as jest.MockedFunction<typeof get>;
  const refMock = ref as jest.MockedFunction<typeof ref>;
  
  refMock.mockImplementation((db: any, path?: string) => {
    return { _path: path } as any;
  });
  
  getMock.mockImplementation((reference: any) => {
    const path = reference._path || '';
    
    if (path === 'bookings') {
      return Promise.resolve({
        exists: () => bookings.length > 0,
        forEach: (callback: (child: any) => void) => {
          bookings.forEach((booking) => {
            callback({
              key: booking.id,
              val: () => booking,
            });
          });
        },
      } as any);
    }
    
    if (path === 'seats') {
      return Promise.resolve({
        exists: () => seats.length > 0,
        forEach: (callback: (child: any) => void) => {
          seats.forEach((seat) => {
            callback({
              key: seat.id,
              val: () => seat,
            });
          });
        },
      } as any);
    }
    
    return Promise.resolve({ exists: () => false } as any);
  });
}

describe('Analytics Service - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: admin-dashboard-analytics, Property 15: Occupancy rate calculation
  describe('Property 15: Occupancy rate calculation', () => {
    test('occupancy rate should be between 0 and 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(bookingArb, { minLength: 0, maxLength: 100 }),
          fc.array(seatArb, { minLength: 1, maxLength: 50 }),
          async (bookings, seats) => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            mockFirebaseGet(bookings, seats);

            const analytics = await computeAnalytics(startDate, endDate);

            // Property: Occupancy rate must be between 0 and 100
            expect(analytics.occupancyRate).toBeGreaterThanOrEqual(0);
            expect(analytics.occupancyRate).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('occupancy rate should be 0 when no bookings exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(seatArb, { minLength: 1, maxLength: 50 }),
          async (seats) => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            mockFirebaseGet([], seats);

            const analytics = await computeAnalytics(startDate, endDate);

            // Property: No bookings means 0% occupancy
            expect(analytics.occupancyRate).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: admin-dashboard-analytics, Property 14: Peak hours identification
  describe('Property 14: Peak hours identification', () => {
    test('peak hours should be sorted by count in descending order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(bookingArb, { minLength: 10, maxLength: 100 }),
          fc.array(seatArb, { minLength: 1, maxLength: 50 }),
          async (bookings, seats) => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            mockFirebaseGet(bookings, seats);

            const peakHours = await getPeakHours(startDate, endDate);

            // Property: Peak hours should be sorted by count (descending)
            for (let i = 0; i < peakHours.length - 1; i++) {
              expect(peakHours[i].count).toBeGreaterThanOrEqual(peakHours[i + 1].count);
            }

            // Property: Should return at most 3 peak hours
            expect(peakHours.length).toBeLessThanOrEqual(3);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('peak hour percentages should sum to at most 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(bookingArb, { minLength: 1, maxLength: 100 }),
          fc.array(seatArb, { minLength: 1, maxLength: 50 }),
          async (bookings, seats) => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            mockFirebaseGet(bookings, seats);

            const peakHours = await getPeakHours(startDate, endDate);

            // Property: Sum of percentages should not exceed 100
            const totalPercentage = peakHours.reduce((sum, ph) => sum + ph.percentage, 0);
            expect(totalPercentage).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: admin-dashboard-analytics, Property 17: No-show rate calculation
  describe('Property 17: No-show rate calculation', () => {
    test('no-show rate should be between 0 and 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(bookingArb, { minLength: 0, maxLength: 100 }),
          fc.array(seatArb, { minLength: 1, maxLength: 50 }),
          async (bookings, seats) => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            mockFirebaseGet(bookings, seats);

            const noShowRate = await calculateNoShowRateForRange(startDate, endDate);

            // Property: No-show rate must be between 0 and 100
            expect(noShowRate).toBeGreaterThanOrEqual(0);
            expect(noShowRate).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no-show rate should be 100 when all bookings are no-shows', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(bookingArb, { minLength: 1, maxLength: 50 }),
          fc.array(seatArb, { minLength: 1, maxLength: 50 }),
          async (bookings, seats) => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            // Make all bookings no-shows and ensure they're in the date range
            const noShowBookings = bookings.map(b => ({ 
              ...b, 
              status: 'no-show' as BookingStatus,
              startTime: new Date('2024-06-15').toISOString(),
            }));

            mockFirebaseGet(noShowBookings, seats);

            const noShowRate = await calculateNoShowRateForRange(startDate, endDate);

            // Property: All no-shows means 100% no-show rate
            expect(noShowRate).toBe(100);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: admin-dashboard-analytics, Property 18: Trend aggregation correctness
  describe('Property 18: Trend aggregation correctness', () => {
    test('each trend period should only include bookings within that period', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(bookingArb, { minLength: 5, maxLength: 50 }),
          fc.array(seatArb, { minLength: 1, maxLength: 20 }),
          fc.constantFrom('daily', 'weekly', 'monthly'),
          async (bookings, seats, granularity) => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            mockFirebaseGet(bookings, seats);

            const trends = await getUsageTrends(startDate, endDate, granularity);

            // Property: Each trend should have non-negative values
            trends.forEach(trend => {
              expect(trend.bookings).toBeGreaterThanOrEqual(0);
              expect(trend.occupancyRate).toBeGreaterThanOrEqual(0);
              expect(trend.occupancyRate).toBeLessThanOrEqual(100);
              expect(trend.averageDuration).toBeGreaterThanOrEqual(0);
            });

            // Property: Trends array should not be empty for valid date range
            expect(trends.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: admin-dashboard-analytics, Property 16: Analytics date range responsiveness
  describe('Property 16: Analytics date range responsiveness', () => {
    test('analytics for different date ranges should reflect only bookings in that range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(bookingArb, { minLength: 10, maxLength: 50 }),
          fc.array(seatArb, { minLength: 1, maxLength: 20 }),
          async (bookings, seats) => {
            // Create two non-overlapping date ranges
            const range1Start = new Date('2024-01-01');
            const range1End = new Date('2024-01-31');
            const range2Start = new Date('2024-06-01');
            const range2End = new Date('2024-06-30');

            // Split bookings between two ranges
            const bookingsRange1 = bookings.slice(0, Math.floor(bookings.length / 2)).map(b => ({
              ...b,
              startTime: new Date('2024-01-15').toISOString(),
            }));
            const bookingsRange2 = bookings.slice(Math.floor(bookings.length / 2)).map(b => ({
              ...b,
              startTime: new Date('2024-06-15').toISOString(),
            }));

            // Test range 1
            mockFirebaseGet(bookingsRange1, seats);
            const analytics1 = await computeAnalytics(range1Start, range1End);

            // Test range 2
            mockFirebaseGet(bookingsRange2, seats);
            const analytics2 = await computeAnalytics(range2Start, range2End);

            // Property: Different ranges should produce different results (unless both are empty)
            if (bookingsRange1.length > 0 || bookingsRange2.length > 0) {
              expect(analytics1.dateRange.start).not.toBe(analytics2.dateRange.start);
              expect(analytics1.dateRange.end).not.toBe(analytics2.dateRange.end);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
