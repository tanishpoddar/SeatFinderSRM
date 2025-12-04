import * as fc from 'fast-check';
import {
  checkExtensionAvailability,
  extendBooking,
  checkPolicyLimits,
  extendBookingWithPolicy,
  findAlternativeSeats,
  isUrgentExtension,
  processExtensionWithPriority,
  __test__,
} from './booking-extension';
import { Booking, Seat, LibrarySettings } from '@/types';

// Arbitraries for generating test data
const bookingArb = fc.record({
  id: fc.uuid(),
  seatId: fc.uuid(),
  userId: fc.uuid(),
  userName: fc.string({ minLength: 3, maxLength: 20 }),
  userEmail: fc.emailAddress(),
  bookingTime: fc.integer({ min: Date.now() - 86400000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
  startTime: fc.integer({ min: Date.now() - 3600000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
  endTime: fc.integer({ min: Date.now() + 1800000, max: Date.now() + 7200000 }).map(ts => new Date(ts).toISOString()),
  status: fc.constantFrom('active', 'pending'),
  duration: fc.integer({ min: 60, max: 240 }),
  createdAt: fc.integer({ min: Date.now() - 86400000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
  updatedAt: fc.integer({ min: Date.now() - 86400000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
});

const seatArb = fc.record({
  id: fc.uuid(),
  number: fc.integer({ min: 1, max: 100 }).map(n => `S${n}`),
  section: fc.constantFrom('A', 'B', 'C'),
  floor: fc.constantFrom('1', '2', '3'),
  status: fc.constantFrom('available', 'occupied', 'reserved'),
  bookedBy: fc.option(fc.uuid(), { nil: null }),
  bookedAt: fc.option(fc.integer({ min: Date.now() - 86400000, max: Date.now() }), { nil: null }),
  bookingId: fc.option(fc.uuid(), { nil: null }),
  occupiedUntil: fc.option(fc.integer({ min: Date.now(), max: Date.now() + 86400000 }), { nil: null }),
});

const settingsArb: fc.Arbitrary<LibrarySettings> = fc.record({
  operatingHours: fc.constant({} as any),
  holidays: fc.constant([] as any),
  bookingRules: fc.record({
    maxDailyDuration: fc.integer({ min: 240, max: 480 }),
    maxAdvanceBookingDays: fc.integer({ min: 7, max: 30 }),
    minBookingDuration: fc.integer({ min: 30, max: 60 }),
    maxBookingDuration: fc.integer({ min: 180, max: 360 }),
    extensionIncrement: fc.integer({ min: 15, max: 60 }),
  }),
  updatedBy: fc.uuid(),
  updatedAt: fc.integer({ min: Date.now() - 86400000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
}) as fc.Arbitrary<LibrarySettings>;

describe('Booking Extension Service - Property-Based Tests', () => {
  beforeEach(() => {
    __test__.clear();
  });

  // Feature: admin-dashboard-analytics, Property 47: Extension availability check
  test('Property 47: For any booking extension request, system verifies seat availability before allowing extension', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookingArb,
        seatArb,
        fc.integer({ min: 30, max: 120 }),
        async (booking, seat, additionalMinutes) => {
          // Set up booking and seat
          const bookingWithSeat = { ...booking, seatId: seat.id };
          __test__.setBookings([bookingWithSeat]);
          __test__.setSeats([seat]);
          
          // Check availability
          const result = await checkExtensionAvailability(bookingWithSeat.id, additionalMinutes);
          
          // Result should indicate whether extension is available
          expect(typeof result.available).toBe('boolean');
          
          // If not available, should provide a reason
          if (!result.available) {
            expect(result.reason).toBeDefined();
            expect(typeof result.reason).toBe('string');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 48: Successful extension updates end time
  test('Property 48: For any successful booking extension, booking end time is updated to reflect additional duration', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookingArb,
        seatArb,
        fc.integer({ min: 30, max: 120 }),
        async (booking, seat, additionalMinutes) => {
          // Set up booking and seat with no conflicts
          const bookingWithSeat = { ...booking, seatId: seat.id };
          __test__.setBookings([bookingWithSeat]);
          __test__.setSeats([seat]);
          
          const originalEndTime = new Date(bookingWithSeat.endTime);
          
          // Extend booking
          const result = await extendBooking(bookingWithSeat.id, additionalMinutes);
          
          if (result.success) {
            // Verify end time was updated
            expect(result.newEndTime).toBeDefined();
            
            const newEndTime = new Date(result.newEndTime!);
            const expectedEndTime = new Date(originalEndTime.getTime() + additionalMinutes * 60000);
            
            // Allow 1 second tolerance for timing differences
            expect(Math.abs(newEndTime.getTime() - expectedEndTime.getTime())).toBeLessThan(1000);
            
            // Verify booking in database was updated
            const updatedBooking = __test__.getBookings().find(b => b.id === bookingWithSeat.id);
            expect(updatedBooking?.endTime).toBe(result.newEndTime);
            expect(updatedBooking?.duration).toBe(booking.duration + additionalMinutes);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 49: Failed extension provides alternatives
  test('Property 49: For any extension request that cannot be fulfilled, system provides alternative seats', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookingArb,
        seatArb,
        fc.array(seatArb, { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 30, max: 120 }),
        async (booking, seat, otherSeats, additionalMinutes) => {
          // Create a conflicting booking to make extension fail
          const conflictingBooking: Booking = {
            ...booking,
            id: 'conflict-' + booking.id,
            seatId: seat.id,
            startTime: new Date(new Date(booking.endTime).getTime() + 1800000).toISOString(),
            endTime: new Date(new Date(booking.endTime).getTime() + 5400000).toISOString(),
          };
          
          const bookingWithSeat = { ...booking, seatId: seat.id };
          
          // Set up seats in same section as alternatives
          const alternativeSeats = otherSeats.map(s => ({
            ...s,
            section: seat.section,
            status: 'available' as const,
          }));
          
          __test__.setBookings([bookingWithSeat, conflictingBooking]);
          __test__.setSeats([seat, ...alternativeSeats]);
          
          // Try to extend
          const result = await extendBooking(bookingWithSeat.id, additionalMinutes);
          
          if (!result.success) {
            // Should provide alternatives
            expect(result.alternatives).toBeDefined();
            expect(Array.isArray(result.alternatives)).toBe(true);
            
            // All alternatives should be available seats
            result.alternatives?.forEach(alt => {
              expect(alt.status).toBe('available');
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 50: Extension policy enforcement
  test('Property 50: For any booking extension exceeding maximum daily duration limits, extension is rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookingArb,
        seatArb,
        settingsArb,
        async (booking, seat, settings) => {
          // Set up booking with duration close to max
          const bookingWithSeat = {
            ...booking,
            seatId: seat.id,
            duration: settings.bookingRules.maxDailyDuration - 30,
          };
          
          __test__.setBookings([bookingWithSeat]);
          __test__.setSeats([seat]);
          __test__.setSettings(settings);
          
          // Try to extend beyond max daily duration
          const excessiveExtension = 60; // This would exceed the limit
          
          const result = await extendBookingWithPolicy(bookingWithSeat.id, excessiveExtension);
          
          // Calculate if this would exceed limits
          const newDuration = bookingWithSeat.duration + excessiveExtension;
          const wouldExceedDaily = newDuration > settings.bookingRules.maxDailyDuration;
          const wouldExceedMax = newDuration > settings.bookingRules.maxBookingDuration;
          
          if (wouldExceedDaily || wouldExceedMax) {
            // Extension should be rejected
            expect(result.success).toBe(false);
            expect(result.message).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 51: Urgent extension prioritization
  test('Property 51: For any extension request within 15 minutes of booking end, request is processed with higher priority', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookingArb,
        seatArb,
        fc.integer({ min: 1, max: 14 }),
        fc.integer({ min: 30, max: 60 }),
        async (booking, seat, minutesUntilEnd, additionalMinutes) => {
          // Create booking ending soon
          const now = Date.now();
          const endTime = now + minutesUntilEnd * 60000;
          
          const urgentBooking = {
            ...booking,
            seatId: seat.id,
            startTime: new Date(now - 3600000).toISOString(),
            endTime: new Date(endTime).toISOString(),
            status: 'active' as const,
          };
          
          __test__.setBookings([urgentBooking]);
          __test__.setSeats([seat]);
          
          // Check if it's urgent
          const isUrgent = await isUrgentExtension(urgentBooking.id);
          
          // Should be marked as urgent since it's within 15 minutes
          expect(isUrgent).toBe(true);
          
          // Process with priority
          const result = await processExtensionWithPriority(urgentBooking.id, additionalMinutes);
          
          // Should be marked as urgent priority
          expect(result.priority).toBe('urgent');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test: Non-urgent extensions
  test('Extension requests more than 15 minutes before end are marked as standard priority', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookingArb,
        seatArb,
        fc.integer({ min: 16, max: 120 }),
        fc.integer({ min: 30, max: 60 }),
        async (booking, seat, minutesUntilEnd, additionalMinutes) => {
          // Create booking ending later
          const now = Date.now();
          const endTime = now + minutesUntilEnd * 60000;
          
          const standardBooking = {
            ...booking,
            seatId: seat.id,
            startTime: new Date(now - 3600000).toISOString(),
            endTime: new Date(endTime).toISOString(),
            status: 'active' as const,
          };
          
          __test__.setBookings([standardBooking]);
          __test__.setSeats([seat]);
          
          // Check if it's urgent
          const isUrgent = await isUrgentExtension(standardBooking.id);
          
          // Should not be urgent since it's more than 15 minutes away
          expect(isUrgent).toBe(false);
          
          // Process with priority
          const result = await processExtensionWithPriority(standardBooking.id, additionalMinutes);
          
          // Should be marked as standard priority
          expect(result.priority).toBe('standard');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test: Extension stores original end time
  test('First extension stores original end time in extendedFrom field', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookingArb,
        seatArb,
        fc.integer({ min: 30, max: 60 }),
        async (booking, seat, additionalMinutes) => {
          const bookingWithSeat = { ...booking, seatId: seat.id };
          __test__.setBookings([bookingWithSeat]);
          __test__.setSeats([seat]);
          
          const originalEndTime = bookingWithSeat.endTime;
          
          const result = await extendBooking(bookingWithSeat.id, additionalMinutes);
          
          if (result.success) {
            const updatedBooking = __test__.getBookings().find(b => b.id === bookingWithSeat.id);
            
            // Should store original end time
            expect(updatedBooking?.extendedFrom).toBe(originalEndTime);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
