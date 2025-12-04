import * as fc from 'fast-check';
import {
  searchSeats,
  filterSeatsByAvailability,
  getAllSeats,
  markSeatMaintenance,
  markSeatOutOfService,
  restoreSeatToService,
  canBookSeat,
  identifyUserBookings,
  __test__,
} from './seat-management';
import { Seat, SeatStatus, Booking } from '@/types';

// Arbitraries for generating test data
const seatStatusArb = fc.constantFrom<SeatStatus>(
  'available',
  'occupied',
  'reserved',
  'maintenance',
  'out-of-service'
);

const seatArb = fc.record({
  id: fc.uuid(),
  number: fc.oneof(
    fc.integer({ min: 1, max: 100 }).map(n => `S${n}`),
    fc.integer({ min: 1, max: 100 }).map(n => `A${n}`),
    fc.integer({ min: 1, max: 100 }).map(n => `B${n}`)
  ),
  section: fc.constantFrom('A', 'B', 'C', 'D'),
  floor: fc.constantFrom('1', '2', '3'),
  status: seatStatusArb,
  bookedBy: fc.option(fc.uuid(), { nil: null }),
  bookedAt: fc.option(fc.integer({ min: Date.now() - 86400000, max: Date.now() }), { nil: null }),
  bookingId: fc.option(fc.uuid(), { nil: null }),
  occupiedUntil: fc.option(fc.integer({ min: Date.now(), max: Date.now() + 86400000 }), { nil: null }),
});

const maintenanceInfoArb = fc.record({
  reason: fc.constantFrom('Broken chair', 'Cleaning', 'Repair needed', 'Equipment issue'),
  reportedBy: fc.uuid(),
  expectedRestoration: fc.option(fc.integer({ min: Date.now(), max: Date.now() + 7 * 86400000 }).map(ts => new Date(ts).toISOString()), { nil: undefined }),
  startedAt: fc.integer({ min: Date.now() - 86400000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
});

const bookingArb = fc.record({
  id: fc.uuid(),
  seatId: fc.uuid(),
  userId: fc.uuid(),
  userName: fc.string({ minLength: 3, maxLength: 20 }),
  userEmail: fc.emailAddress(),
  bookingTime: fc.integer({ min: Date.now() - 86400000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
  startTime: fc.integer({ min: Date.now(), max: Date.now() + 7 * 86400000 }).map(ts => new Date(ts).toISOString()),
  endTime: fc.integer({ min: Date.now() + 3600000, max: Date.now() + 8 * 86400000 }).map(ts => new Date(ts).toISOString()),
  status: fc.constantFrom('pending', 'active', 'completed', 'cancelled', 'no-show', 'expired'),
  duration: fc.integer({ min: 30, max: 480 }),
  createdAt: fc.integer({ min: Date.now() - 86400000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
  updatedAt: fc.integer({ min: Date.now() - 86400000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
});

describe('Seat Management Service - Property-Based Tests', () => {
  beforeEach(() => {
    __test__.clear();
  });

  // Feature: admin-dashboard-analytics, Property 8: Seat search filtering
  test('Property 8: For any seat number search query, displayed seats include only those whose number contains the search term', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(seatArb, { minLength: 5, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 3 }),
        async (seats, query) => {
          __test__.setSeats(seats);
          
          const results = await searchSeats(query);
          const normalizedQuery = query.toLowerCase().trim();
          
          // All results should contain the query in their seat number
          const allMatch = results.every(seat =>
            seat.number.toLowerCase().includes(normalizedQuery)
          );
          
          // All seats that contain the query should be in results
          const expectedSeats = seats.filter(seat =>
            seat.number.toLowerCase().includes(normalizedQuery)
          );
          
          expect(allMatch).toBe(true);
          expect(results.length).toBe(expectedSeats.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 9: Search clear restores full view
  test('Property 9: For any seat map state, applying search and then clearing restores original full display', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(seatArb, { minLength: 5, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 3 }),
        async (seats, query) => {
          __test__.setSeats(seats);
          
          // Get original full view
          const originalSeats = await searchSeats('');
          
          // Apply search
          await searchSeats(query);
          
          // Clear search (empty query)
          const restoredSeats = await searchSeats('');
          
          // Should restore to original full view
          expect(restoredSeats.length).toBe(originalSeats.length);
          expect(restoredSeats.length).toBe(seats.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 10: Availability filter accuracy
  test('Property 10: For any collection of seats, availability filter shows only available seats', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(seatArb, { minLength: 5, maxLength: 50 }),
        async (seats) => {
          __test__.setSeats(seats);
          
          const allSeats = await getAllSeats();
          const filteredSeats = await filterSeatsByAvailability(allSeats, true);
          
          // All filtered seats should have 'available' status
          const allAvailable = filteredSeats.every(seat => seat.status === 'available');
          
          // Count should match available seats in original collection
          const expectedCount = seats.filter(s => s.status === 'available').length;
          
          expect(allAvailable).toBe(true);
          expect(filteredSeats.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 11: Filter toggle restores all seats
  test('Property 11: For any seat collection, enabling and disabling availability filter displays all seats', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(seatArb, { minLength: 5, maxLength: 50 }),
        async (seats) => {
          __test__.setSeats(seats);
          
          const allSeats = await getAllSeats();
          
          // Enable filter
          await filterSeatsByAvailability(allSeats, true);
          
          // Disable filter
          const restoredSeats = await filterSeatsByAvailability(allSeats, false);
          
          // Should show all seats regardless of status
          expect(restoredSeats.length).toBe(allSeats.length);
          expect(restoredSeats.length).toBe(seats.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 28: Maintenance prevents bookings
  test('Property 28: For any seat marked as under maintenance, booking attempts should be rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        seatArb,
        maintenanceInfoArb,
        async (seat, maintenanceInfo) => {
          __test__.setSeats([seat]);
          
          // Mark seat as maintenance
          await markSeatMaintenance(seat.id, maintenanceInfo);
          
          // Try to book the seat
          const canBook = await canBookSeat(seat.id);
          
          // Booking should be rejected
          expect(canBook).toBe(false);
          
          // Verify seat status is maintenance
          const updatedSeat = __test__.getSeats().find(s => s.id === seat.id);
          expect(updatedSeat?.status).toBe('maintenance');
          expect(updatedSeat?.maintenanceInfo).toEqual(maintenanceInfo);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 29: Out-of-service cancels future bookings
  test('Property 29: For any seat marked out of service, all future bookings should be cancelled', async () => {
    await fc.assert(
      fc.asyncProperty(
        seatArb,
        fc.array(bookingArb, { minLength: 1, maxLength: 10 }),
        maintenanceInfoArb,
        fc.uuid(),
        async (seat, bookings, maintenanceInfo, adminId) => {
          // Set up seat and bookings for this seat
          const seatBookings = bookings.map(b => ({
            ...b,
            seatId: seat.id,
            startTime: new Date(Date.now() + 3600000).toISOString(), // Future booking
            status: 'pending' as const,
          }));
          
          __test__.setSeats([seat]);
          __test__.setBookings(seatBookings);
          
          // Mark seat out of service
          const result = await markSeatOutOfService(seat.id, maintenanceInfo, adminId);
          
          // All future bookings should be cancelled
          const updatedBookings = __test__.getBookings();
          const cancelledCount = updatedBookings.filter(
            b => b.seatId === seat.id && b.status === 'cancelled'
          ).length;
          
          expect(cancelledCount).toBe(seatBookings.length);
          expect(result.cancelledBookings.length).toBe(seatBookings.length);
          
          // Verify seat status
          const updatedSeat = __test__.getSeats().find(s => s.id === seat.id);
          expect(updatedSeat?.status).toBe('out-of-service');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 30: Service restoration enables bookings
  test('Property 30: For any seat restored to service from maintenance, new booking attempts should succeed', async () => {
    await fc.assert(
      fc.asyncProperty(
        seatArb,
        maintenanceInfoArb,
        async (seat, maintenanceInfo) => {
          // Start with seat in maintenance
          const maintenanceSeat = {
            ...seat,
            status: 'maintenance' as SeatStatus,
            maintenanceInfo,
            bookedBy: null,
            bookingId: null,
          };
          
          __test__.setSeats([maintenanceSeat]);
          
          // Verify booking is not allowed
          const canBookBefore = await canBookSeat(maintenanceSeat.id);
          expect(canBookBefore).toBe(false);
          
          // Restore seat to service
          await restoreSeatToService(maintenanceSeat.id);
          
          // Verify booking is now allowed
          const canBookAfter = await canBookSeat(maintenanceSeat.id);
          expect(canBookAfter).toBe(true);
          
          // Verify seat status is available
          const updatedSeat = __test__.getSeats().find(s => s.id === maintenanceSeat.id);
          expect(updatedSeat?.status).toBe('available');
          expect(updatedSeat?.maintenanceInfo).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test: User ownership highlighting
  test('Property 13: User ownership highlighting - seats booked by user should be identified', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(seatArb, { minLength: 5, maxLength: 20 }),
        fc.uuid(),
        async (seats, userId) => {
          // Mark some seats as booked by the user
          const seatsWithUser = seats.map((seat, idx) => ({
            ...seat,
            bookedBy: idx % 3 === 0 ? userId : seat.bookedBy,
          }));
          
          __test__.setSeats(seatsWithUser);
          
          const allSeats = await getAllSeats();
          const identified = await identifyUserBookings(allSeats, userId);
          
          // Verify correct identification
          identified.forEach(seat => {
            if (seat.bookedBy === userId) {
              expect(seat.isUserBooking).toBe(true);
            } else {
              expect(seat.isUserBooking).toBe(false);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
