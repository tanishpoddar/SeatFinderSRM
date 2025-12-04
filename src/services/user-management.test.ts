import * as fc from 'fast-check';
import type { UserProfile, Booking, BookingStatus } from '@/types';

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  db: {},
}));

jest.mock('firebase/database', () => ({
  ref: jest.fn(),
  get: jest.fn(),
  update: jest.fn(),
  push: jest.fn(() => ({ key: 'mock-key' })),
  set: jest.fn(),
  query: jest.fn(),
  orderByChild: jest.fn(),
  equalTo: jest.fn(),
}));

// Import after mocking
import {
  getUserProfile,
  getUserBookingHistory,
  flagUser,
  unflagUser,
  searchUsers,
  getUserStatistics,
} from './user-management';
import { ref, get, update } from 'firebase/database';

// Custom Generators
const userProfileArb = fc.record({
  uid: fc.uuid(),
  email: fc.emailAddress(),
  displayName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), {
    nil: undefined,
  }),
  photoURL: fc.option(fc.webUrl(), { nil: undefined }),
  role: fc.constantFrom('user', 'admin'),
  currentBookingId: fc.option(fc.uuid(), { nil: undefined }),
  restrictions: fc.option(
    fc.record({
      isFlagged: fc.boolean(),
      reason: fc.option(fc.string({ minLength: 5, maxLength: 100 }), {
        nil: undefined,
      }),
      flaggedBy: fc.option(fc.uuid(), { nil: undefined }),
      flaggedAt: fc.option(
        fc
          .integer({ min: 1704067200000, max: 1735689600000 })
          .map((ts) => new Date(ts).toISOString()),
        { nil: undefined }
      ),
    }),
    { nil: undefined }
  ),
  stats: fc.record({
    totalBookings: fc.integer({ min: 0, max: 1000 }),
    noShowCount: fc.integer({ min: 0, max: 100 }),
    overstayCount: fc.integer({ min: 0, max: 100 }),
    totalHoursBooked: fc.float({ min: 0, max: 10000 }),
  }),
  createdAt: fc
    .integer({ min: 1704067200000, max: 1735689600000 })
    .map((ts) => new Date(ts).toISOString()),
  updatedAt: fc
    .integer({ min: 1704067200000, max: 1735689600000 })
    .map((ts) => new Date(ts).toISOString()),
}) as fc.Arbitrary<UserProfile>;

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
function mockFirebaseGetUser(user: UserProfile | null) {
  const getMock = get as jest.MockedFunction<typeof get>;
  const refMock = ref as jest.MockedFunction<typeof ref>;

  refMock.mockImplementation((db: any, path?: string) => {
    return { _path: path } as any;
  });

  getMock.mockImplementation((reference: any) => {
    const path = reference._path || '';

    if (path.startsWith('users/')) {
      return Promise.resolve({
        exists: () => user !== null,
        val: () => user,
      } as any);
    }

    return Promise.resolve({ exists: () => false } as any);
  });
}

function mockFirebaseGetBookings(bookings: Booking[]) {
  const getMock = get as jest.MockedFunction<typeof get>;
  const refMock = ref as jest.MockedFunction<typeof ref>;

  refMock.mockImplementation((db: any, path?: string) => {
    return { _path: path } as any;
  });

  getMock.mockImplementation((reference: any) => {
    const path = reference._path || '';

    // Handle new path structure: bookings/{userId}
    if (path.startsWith('bookings/')) {
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

    if (path.startsWith('users/')) {
      return Promise.resolve({
        exists: () => true,
        val: () => ({ uid: 'test-user' }),
      } as any);
    }

    return Promise.resolve({ exists: () => false } as any);
  });
}

function mockFirebaseGetUsers(users: UserProfile[]) {
  const getMock = get as jest.MockedFunction<typeof get>;
  const refMock = ref as jest.MockedFunction<typeof ref>;

  refMock.mockImplementation((db: any, path?: string) => {
    return { _path: path } as any;
  });

  getMock.mockImplementation((reference: any) => {
    const path = reference._path || '';

    if (path === 'users') {
      return Promise.resolve({
        exists: () => users.length > 0,
        forEach: (callback: (child: any) => void) => {
          users.forEach((user) => {
            callback({
              key: user.uid,
              val: () => user,
            });
          });
        },
      } as any);
    }

    return Promise.resolve({ exists: () => false } as any);
  });
}

describe('User Management Service - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: admin-dashboard-analytics, Property 26: User flagging prevents bookings
  describe('Property 26: User flagging prevents bookings', () => {
    test('flagged user should have isFlagged set to true', async () => {
      await fc.assert(
        fc.asyncProperty(
          userProfileArb,
          fc.uuid(),
          fc.string({ minLength: 5, maxLength: 100 }),
          async (user, adminId, reason) => {
            const updateMock = update as jest.MockedFunction<typeof update>;
            const updates: any[] = [];

            updateMock.mockImplementation((ref: any, data: any) => {
              updates.push({ ref, data });
              return Promise.resolve();
            });

            mockFirebaseGetUser(user);

            await flagUser(user.uid, reason, adminId);

            // Property: User should be flagged
            const userUpdate = updates.find((u) =>
              (u.ref._path as string)?.includes('users/')
            );
            expect(userUpdate).toBeDefined();
            expect(userUpdate.data.restrictions.isFlagged).toBe(true);
            expect(userUpdate.data.restrictions.reason).toBe(reason);
            expect(userUpdate.data.restrictions.flaggedBy).toBe(adminId);
            expect(userUpdate.data.restrictions.flaggedAt).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: admin-dashboard-analytics, Property 27: Flag removal restores privileges
  describe('Property 27: Flag removal restores privileges', () => {
    test('unflagged user should have isFlagged set to false', async () => {
      await fc.assert(
        fc.asyncProperty(
          userProfileArb,
          fc.uuid(),
          async (user, adminId) => {
            const updateMock = update as jest.MockedFunction<typeof update>;
            const updates: any[] = [];

            updateMock.mockImplementation((ref: any, data: any) => {
              updates.push({ ref, data });
              return Promise.resolve();
            });

            // Start with a flagged user
            const flaggedUser = {
              ...user,
              restrictions: {
                isFlagged: true,
                reason: 'Test reason',
                flaggedBy: 'admin-123',
                flaggedAt: new Date().toISOString(),
              },
            };

            mockFirebaseGetUser(flaggedUser);

            await unflagUser(user.uid, adminId);

            // Property: User should be unflagged
            const userUpdate = updates.find((u) =>
              (u.ref._path as string)?.includes('users/')
            );
            expect(userUpdate).toBeDefined();
            expect(userUpdate.data.restrictions.isFlagged).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: admin-dashboard-analytics, Property 60: User statistics display completeness
  describe('Property 60: User statistics display completeness', () => {
    test('user statistics should include all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(bookingArb, { minLength: 0, maxLength: 50 }),
          async (userId, bookings) => {
            // Set all bookings to the same user
            const userBookings = bookings.map((b) => ({ ...b, userId }));

            mockFirebaseGetBookings(userBookings);

            const stats = await getUserStatistics(userId);

            // Property: All required fields should be present
            expect(stats).toHaveProperty('totalBookings');
            expect(stats).toHaveProperty('totalHoursBooked');
            expect(stats).toHaveProperty('averageSessionDuration');
            expect(stats).toHaveProperty('noShowCount');
            expect(stats).toHaveProperty('overstayCount');
            expect(stats).toHaveProperty('mostBookedSeats');
            expect(stats).toHaveProperty('preferredTimeSlots');
            expect(stats).toHaveProperty('weeklyUsage');
            expect(stats).toHaveProperty('monthlyUsage');

            // Property: Numeric fields should be non-negative
            expect(stats.totalBookings).toBeGreaterThanOrEqual(0);
            expect(stats.totalHoursBooked).toBeGreaterThanOrEqual(0);
            expect(stats.averageSessionDuration).toBeGreaterThanOrEqual(0);
            expect(stats.noShowCount).toBeGreaterThanOrEqual(0);
            expect(stats.overstayCount).toBeGreaterThanOrEqual(0);

            // Property: Arrays should be defined
            expect(Array.isArray(stats.mostBookedSeats)).toBe(true);
            expect(Array.isArray(stats.preferredTimeSlots)).toBe(true);
            expect(Array.isArray(stats.weeklyUsage)).toBe(true);
            expect(Array.isArray(stats.monthlyUsage)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: admin-dashboard-analytics, Property 61: Usage pattern identification
  describe('Property 61: Usage pattern identification', () => {
    test('most booked seats should be sorted by count descending', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(bookingArb, { minLength: 10, maxLength: 50 }),
          async (userId, bookings) => {
            // Set all bookings to completed with entry time
            const completedBookings = bookings.map((b) => ({
              ...b,
              userId,
              status: 'completed' as BookingStatus,
              entryTime: new Date('2024-06-15T10:00:00Z').toISOString(),
              exitTime: new Date('2024-06-15T12:00:00Z').toISOString(),
            }));

            mockFirebaseGetBookings(completedBookings);

            const stats = await getUserStatistics(userId);

            // Property: Most booked seats should be sorted by count (descending)
            for (let i = 0; i < stats.mostBookedSeats.length - 1; i++) {
              expect(stats.mostBookedSeats[i].count).toBeGreaterThanOrEqual(
                stats.mostBookedSeats[i + 1].count
              );
            }

            // Property: Should return at most 5 seats
            expect(stats.mostBookedSeats.length).toBeLessThanOrEqual(5);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('preferred time slots should be sorted by count descending', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(bookingArb, { minLength: 10, maxLength: 50 }),
          async (userId, bookings) => {
            // Set all bookings to completed with entry time
            const completedBookings = bookings.map((b) => ({
              ...b,
              userId,
              status: 'completed' as BookingStatus,
              entryTime: new Date('2024-06-15T10:00:00Z').toISOString(),
              exitTime: new Date('2024-06-15T12:00:00Z').toISOString(),
            }));

            mockFirebaseGetBookings(completedBookings);

            const stats = await getUserStatistics(userId);

            // Property: Preferred time slots should be sorted by count (descending)
            for (let i = 0; i < stats.preferredTimeSlots.length - 1; i++) {
              expect(stats.preferredTimeSlots[i].count).toBeGreaterThanOrEqual(
                stats.preferredTimeSlots[i + 1].count
              );
            }

            // Property: Should return at most 5 time slots
            expect(stats.preferredTimeSlots.length).toBeLessThanOrEqual(5);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: admin-dashboard-analytics, Property 63: Metrics calculation filtering
  describe('Property 63: Metrics calculation filtering', () => {
    test('statistics should only include completed bookings with check-in', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(bookingArb, { minLength: 10, maxLength: 50 }),
          async (userId, bookings) => {
            // Mix of completed and non-completed bookings
            const mixedBookings = bookings.map((b, index) => {
              if (index % 3 === 0) {
                // Completed with entry time
                return {
                  ...b,
                  userId,
                  status: 'completed' as BookingStatus,
                  entryTime: new Date('2024-06-15T10:00:00Z').toISOString(),
                  exitTime: new Date('2024-06-15T12:00:00Z').toISOString(),
                };
              } else if (index % 3 === 1) {
                // Completed without entry time (should be excluded)
                return {
                  ...b,
                  userId,
                  status: 'completed' as BookingStatus,
                  entryTime: undefined,
                };
              } else {
                // Not completed (should be excluded)
                return {
                  ...b,
                  userId,
                  status: 'pending' as BookingStatus,
                };
              }
            });

            mockFirebaseGetBookings(mixedBookings);

            const stats = await getUserStatistics(userId);

            // Count expected completed bookings with entry time
            const expectedCompleted = mixedBookings.filter(
              (b) => b.status === 'completed' && b.entryTime
            ).length;

            // Property: Total hours should only come from completed bookings with check-in
            if (expectedCompleted > 0) {
              expect(stats.totalHoursBooked).toBeGreaterThan(0);
            }

            // Property: Average should be calculated from completed bookings only
            if (expectedCompleted > 0) {
              expect(stats.averageSessionDuration).toBeGreaterThan(0);
            } else {
              expect(stats.averageSessionDuration).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Additional test for search functionality
  describe('User search functionality', () => {
    test('search should return users matching email or name', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(userProfileArb, { minLength: 5, maxLength: 20 }),
          fc.string({ minLength: 2, maxLength: 10 }),
          async (users, searchTerm) => {
            mockFirebaseGetUsers(users);

            const results = await searchUsers(searchTerm);

            // Property: All results should match the search term
            const searchLower = searchTerm.toLowerCase().trim();
            results.forEach((user) => {
              const matchesEmail = user.email.toLowerCase().includes(searchLower);
              const matchesName = user.displayName
                ?.toLowerCase()
                .includes(searchLower);
              expect(matchesEmail || matchesName).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
