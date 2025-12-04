import * as fc from 'fast-check';
import type { Booking, BookingFilters, BookingStatus } from '@/types';

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  db: {},
}));

jest.mock('firebase/database', () => ({
  ref: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  push: jest.fn(() => ({ key: 'mock-key' })),
}));

// Import after mocking
import { getAllBookings, getPaginatedBookings, cancelBooking, manuallyAssignSeat, manualCheckIn, manualCheckOut } from './booking-management';
import { ref, get, set, update } from 'firebase/database';

// Custom Generators
const bookingStatusArb = fc.constantFrom<BookingStatus>(
  'pending',
  'active',
  'completed',
  'cancelled',
  'no-show',
  'expired'
);

const validDateArb = fc
  .integer({ min: 1704067200000, max: 1735689600000 })
  .map((ts) => new Date(ts));

const bookingArb = fc.record({
  id: fc.uuid(),
  seatId: fc.uuid(),
  userId: fc.uuid(),
  userName: fc.string({ minLength: 1, maxLength: 50 }),
  userEmail: fc.emailAddress(),
  bookingTime: validDateArb.map((d) => d.toISOString()),
  startTime: validDateArb.map((d) => d.toISOString()),
  endTime: validDateArb.map((d) => {
    const start = new Date(d);
    start.setHours(start.getHours() + 2);
    return start.toISOString();
  }),
  entryTime: fc.option(validDateArb.map((d) => d.toISOString()), {
    nil: undefined,
  }),
  exitTime: fc.option(validDateArb.map((d) => d.toISOString()), {
    nil: undefined,
  }),
  status: bookingStatusArb,
  duration: fc.integer({ min: 30, max: 480 }),
  createdAt: validDateArb.map((d) => d.toISOString()),
  updatedAt: validDateArb.map((d) => d.toISOString()),
}) as fc.Arbitrary<Booking>;

// Helper to mock Firebase responses
function mockFirebaseGetBookings(bookings: Booking[]) {
  const getMock = get as jest.MockedFunction<typeof get>;
  const refMock = ref as jest.MockedFunction<typeof ref>;

  refMock.mockImplementation((db: any, path?: string) => {
    return { _path: path } as any;
  });

  getMock.mockImplementation((reference: any) => {
    const path = reference._path || '';

    if (path === 'bookings' || path.startsWith('bookings/')) {
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
        val: () => (bookings.length > 0 ? bookings[0] : null),
      } as any);
    }

    return Promise.resolve({ exists: () => false } as any);
  });
}

describe('Booking Management Service - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: admin-dashboard-analytics, Property 7: Search filter accuracy
  describe('Property 7: Search filter accuracy', () => {
    test('filtered bookings should match all specified criteria', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(bookingArb, { minLength: 10, maxLength: 50 }),
          fc.record({
            userId: fc.option(fc.uuid(), { nil: undefined }),
            seatId: fc.option(fc.uuid(), { nil: undefined }),
            status: fc.option(bookingStatusArb, { nil: undefined }),
            searchTerm: fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
              nil: undefined,
            }),
          }),
          async (bookings, filters) => {
            mockFirebaseGetBookings(bookings);

            const filtered = await getAllBookings(filters);

            // Property: All filtered results must match the filter criteria
            filtered.forEach((booking) => {
              if (filters.userId) {
                expect(booking.userId).toBe(filters.userId);
              }
              if (filters.seatId) {
                expect(booking.seatId).toBe(filters.seatId);
              }
              if (filters.status) {
                expect(booking.status).toBe(filters.status);
              }
              if (filters.searchTerm && filters.searchTerm.trim()) {
                const searchLower = filters.searchTerm.toLowerCase().trim();
                const matchesSearch =
                  booking.userName.toLowerCase().includes(searchLower) ||
                  booking.userEmail.toLowerCase().includes(searchLower) ||
                  booking.seatId.toLowerCase().includes(searchLower);
                expect(matchesSearch).toBe(true);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('date range filters should only return bookings within range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(bookingArb, { minLength: 10, maxLength: 50 }),
          async (bookings) => {
            const startDate = new Date('2024-03-01');
            const endDate = new Date('2024-09-30');

            mockFirebaseGetBookings(bookings);

            const filtered = await getAllBookings({ startDate, endDate });

            // Property: All filtered bookings must be within date range
            filtered.forEach((booking) => {
              const bookingDate = new Date(booking.startTime);
              expect(bookingDate.getTime()).toBeGreaterThanOrEqual(
                startDate.getTime()
              );
              expect(bookingDate.getTime()).toBeLessThanOrEqual(
                endDate.getTime()
              );
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('empty filters should return all bookings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(bookingArb, { minLength: 1, maxLength: 50 }),
          async (bookings) => {
            mockFirebaseGetBookings(bookings);

            const filtered = await getAllBookings({});

            // Property: No filters means all bookings returned
            expect(filtered.length).toBe(bookings.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: admin-dashboard-analytics, Property 6: Pagination consistency
  describe('Property 6: Pagination consistency', () => {
    test('paginating through all pages should present every booking exactly once', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(bookingArb, { minLength: 10, maxLength: 100 }),
          fc.integer({ min: 5, max: 20 }),
          async (bookings, pageSize) => {
            mockFirebaseGetBookings(bookings);

            const allPaginatedBookings: Booking[] = [];
            const totalPages = Math.ceil(bookings.length / pageSize);

            // Fetch all pages
            for (let page = 1; page <= totalPages; page++) {
              const result = await getPaginatedBookings(page, pageSize);
              allPaginatedBookings.push(...result.bookings);
            }

            // Property: Total count should match
            expect(allPaginatedBookings.length).toBe(bookings.length);

            // Property: No duplicates
            const ids = allPaginatedBookings.map((b) => b.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);

            // Property: All original bookings should be present
            const originalIds = new Set(bookings.map((b) => b.id));
            ids.forEach((id) => {
              expect(originalIds.has(id)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('page size should be respected', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(bookingArb, { minLength: 20, maxLength: 100 }),
          fc.integer({ min: 5, max: 15 }),
          async (bookings, pageSize) => {
            mockFirebaseGetBookings(bookings);

            const result = await getPaginatedBookings(1, pageSize);

            // Property: First page should have at most pageSize items
            expect(result.bookings.length).toBeLessThanOrEqual(pageSize);

            // Property: Total pages calculation should be correct
            const expectedPages = Math.ceil(bookings.length / pageSize);
            expect(result.totalPages).toBe(expectedPages);

            // Property: Total count should match
            expect(result.total).toBe(bookings.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: admin-dashboard-analytics, Property 22: Booking cancellation effects
  describe('Property 22: Booking cancellation effects', () => {
    test('cancelled booking should update status and release seat', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingArb,
          fc.uuid(),
          fc.string({ minLength: 5, maxLength: 100 }),
          async (booking, adminId, reason) => {
            const updateMock = update as jest.MockedFunction<typeof update>;
            const updates: any[] = [];

            updateMock.mockImplementation((ref: any, data: any) => {
              updates.push({ ref, data });
              return Promise.resolve();
            });

            mockFirebaseGetBookings([booking]);

            await cancelBooking(booking.id, adminId, reason);

            // Property: Booking should be updated with cancelled status
            const bookingUpdate = updates.find((u) =>
              u.ref._path?.includes('bookings')
            );
            expect(bookingUpdate).toBeDefined();
            expect(bookingUpdate.data.status).toBe('cancelled');
            expect(bookingUpdate.data.cancelledBy).toBe(adminId);
            expect(bookingUpdate.data.cancelReason).toBe(reason);

            // Property: Seat should be released
            const seatUpdate = updates.find((u) =>
              u.ref._path?.includes('seats')
            );
            expect(seatUpdate).toBeDefined();
            expect(seatUpdate.data.status).toBe('available');
            expect(seatUpdate.data.bookedBy).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: admin-dashboard-analytics, Property 23: Manual seat assignment creates booking
  describe('Property 23: Manual seat assignment creates booking', () => {
    test('manual assignment should create booking and update seat status', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.emailAddress(),
          fc.uuid(),
          async (seatId, userId, userName, userEmail, adminId) => {
            const setMock = set as jest.MockedFunction<typeof set>;
            const updateMock = update as jest.MockedFunction<typeof update>;
            const getMock = get as jest.MockedFunction<typeof get>;
            const refMock = ref as jest.MockedFunction<typeof ref>;

            refMock.mockImplementation((db: any, path?: string) => {
              return { _path: path } as any;
            });

            getMock.mockImplementation((reference: any) => {
              const path = reference._path || '';
              if (path.includes('seats')) {
                return Promise.resolve({
                  exists: () => true,
                  val: () => ({ id: seatId, status: 'available' }),
                } as any);
              }
              return Promise.resolve({ exists: () => false } as any);
            });

            const startTime = new Date('2024-06-15T10:00:00Z');
            const endTime = new Date('2024-06-15T12:00:00Z');

            const booking = await manuallyAssignSeat(
              seatId,
              userId,
              userName,
              userEmail,
              startTime,
              endTime,
              adminId
            );

            // Property: Booking should be created
            expect(booking).toBeDefined();
            expect(booking.seatId).toBe(seatId);
            expect(booking.userId).toBe(userId);
            expect(booking.status).toBe('pending');

            // Property: Set should be called to create booking
            expect(setMock).toHaveBeenCalled();

            // Property: Seat should be updated to reserved
            expect(updateMock).toHaveBeenCalled();
            const seatUpdate = updateMock.mock.calls.find((call) =>
              (call[0] as any)._path?.includes('seats')
            );
            expect(seatUpdate).toBeDefined();
            expect((seatUpdate![1] as any).status).toBe('reserved');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: admin-dashboard-analytics, Property 32: Manual check-in updates state
  describe('Property 32: Manual check-in updates state', () => {
    test('manual check-in should update booking to active and record timestamp', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingArb,
          fc.uuid(),
          fc.string({ minLength: 5, maxLength: 100 }),
          async (booking, adminId, reason) => {
            const updateMock = update as jest.MockedFunction<typeof update>;
            const updates: any[] = [];

            updateMock.mockImplementation((ref: any, data: any) => {
              updates.push({ ref, data });
              return Promise.resolve();
            });

            mockFirebaseGetBookings([booking]);

            await manualCheckIn(booking.id, adminId, reason);

            // Property: Booking should be updated to active status
            const bookingUpdate = updates.find((u) =>
              u.ref._path?.includes('bookings')
            );
            expect(bookingUpdate).toBeDefined();
            expect(bookingUpdate.data.status).toBe('active');
            expect(bookingUpdate.data.entryTime).toBeDefined();

            // Property: Seat should be updated to occupied
            const seatUpdate = updates.find((u) =>
              u.ref._path?.includes('seats')
            );
            expect(seatUpdate).toBeDefined();
            expect(seatUpdate.data.status).toBe('occupied');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: admin-dashboard-analytics, Property 33: Manual check-out releases seat
  describe('Property 33: Manual check-out releases seat', () => {
    test('manual check-out should complete booking and release seat', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingArb,
          fc.uuid(),
          fc.string({ minLength: 5, maxLength: 100 }),
          async (booking, adminId, reason) => {
            const updateMock = update as jest.MockedFunction<typeof update>;
            const updates: any[] = [];

            updateMock.mockImplementation((ref: any, data: any) => {
              updates.push({ ref, data });
              return Promise.resolve();
            });

            mockFirebaseGetBookings([booking]);

            await manualCheckOut(booking.id, adminId, reason);

            // Property: Booking should be completed
            const bookingUpdate = updates.find((u) =>
              u.ref._path?.includes('bookings')
            );
            expect(bookingUpdate).toBeDefined();
            expect(bookingUpdate.data.status).toBe('completed');
            expect(bookingUpdate.data.exitTime).toBeDefined();

            // Property: Seat should be released
            const seatUpdate = updates.find((u) =>
              u.ref._path?.includes('seats')
            );
            expect(seatUpdate).toBeDefined();
            expect(seatUpdate.data.status).toBe('available');
            expect(seatUpdate.data.bookedBy).toBeNull();
            expect(seatUpdate.data.bookingId).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
