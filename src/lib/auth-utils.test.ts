import * as fc from 'fast-check';
import {
  authenticateUser,
  authenticateAdmin,
  isAdmin,
  hasRole,
  createSession,
  validateSession,
  verifyAdminAccess,
  canAccessAdminFeatures,
  __test__,
} from './auth-utils';
import { UserProfile } from '@/types';

// Arbitraries for generating test data
const userProfileArb = (role: 'user' | 'admin') => fc.record({
  uid: fc.uuid(),
  email: fc.emailAddress(),
  displayName: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
  photoURL: fc.option(fc.webUrl(), { nil: undefined }),
  role: fc.constant(role),
  currentBookingId: fc.option(fc.uuid(), { nil: undefined }),
  restrictions: fc.option(fc.record({
    isFlagged: fc.boolean(),
    reason: fc.option(fc.string(), { nil: undefined }),
    flaggedBy: fc.option(fc.uuid(), { nil: undefined }),
    flaggedAt: fc.option(fc.integer({ min: Date.now() - 86400000, max: Date.now() }).map(ts => new Date(ts).toISOString()), { nil: undefined }),
  }), { nil: undefined }),
  stats: fc.record({
    totalBookings: fc.integer({ min: 0, max: 100 }),
    noShowCount: fc.integer({ min: 0, max: 10 }),
    overstayCount: fc.integer({ min: 0, max: 10 }),
    totalHoursBooked: fc.integer({ min: 0, max: 1000 }),
  }),
  createdAt: fc.integer({ min: Date.now() - 86400000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
  updatedAt: fc.integer({ min: Date.now() - 86400000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
});

const adminProfileArb = userProfileArb('admin');
const regularUserProfileArb = userProfileArb('user');

const passwordArb = fc.string({ minLength: 8, maxLength: 20 });

describe('Authentication and Authorization - Property-Based Tests', () => {
  beforeEach(() => {
    __test__.clear();
  });

  // Feature: admin-dashboard-analytics, Property 1: Valid admin credentials grant access
  test('Property 1: For any valid administrator email and password, authentication succeeds and grants access', async () => {
    await fc.assert(
      fc.asyncProperty(
        adminProfileArb,
        passwordArb,
        async (profile, password) => {
          // Add admin user
          __test__.addUser(profile.email, password, profile);
          
          // Authenticate with correct credentials
          const result = await authenticateAdmin(profile.email, password);
          
          // Should succeed
          expect(result.success).toBe(true);
          expect(result.sessionId).toBeDefined();
          expect(result.error).toBeUndefined();
          
          // Session should be valid
          if (result.sessionId) {
            const sessionValidation = await validateSession(result.sessionId);
            expect(sessionValidation.valid).toBe(true);
            expect(sessionValidation.userId).toBe(profile.uid);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 2: Invalid credentials are rejected
  test('Property 2: For any invalid credential combination, authentication fails with error message', async () => {
    await fc.assert(
      fc.asyncProperty(
        adminProfileArb,
        passwordArb,
        passwordArb,
        async (profile, correctPassword, wrongPassword) => {
          // Ensure passwords are different
          fc.pre(correctPassword !== wrongPassword);
          
          // Add admin user with correct password
          __test__.addUser(profile.email, correctPassword, profile);
          
          // Try to authenticate with wrong password
          const result = await authenticateAdmin(profile.email, wrongPassword);
          
          // Should fail
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.sessionId).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 3: Expired sessions redirect to login
  test('Property 3: For any expired session, validation fails and indicates expiration', async () => {
    await fc.assert(
      fc.asyncProperty(
        adminProfileArb,
        async (profile) => {
          __test__.addUser(profile.email, 'password123', profile);
          
          // Create a session with very short duration (0 minutes = already expired)
          const sessionId = await createSession(profile.uid, 0);
          
          // Wait a tiny bit to ensure expiration
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Validate session
          const validation = await validateSession(sessionId);
          
          // Should be invalid and marked as expired
          expect(validation.valid).toBe(false);
          expect(validation.expired).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 4: Role-based access control enforcement
  test('Property 4: For any user without admin privileges, access to admin features is denied', async () => {
    await fc.assert(
      fc.asyncProperty(
        regularUserProfileArb,
        passwordArb,
        async (profile, password) => {
          // Add regular user (not admin)
          __test__.addUser(profile.email, password, profile);
          
          // Try to authenticate as admin
          const authResult = await authenticateAdmin(profile.email, password);
          
          // Should fail because user is not admin
          expect(authResult.success).toBe(false);
          expect(authResult.error).toBeDefined();
          expect(authResult.error).toContain('admin');
          
          // Check admin access directly
          const hasAdminAccess = await canAccessAdminFeatures(profile.uid);
          expect(hasAdminAccess).toBe(false);
          
          // Check role
          const userIsAdmin = await isAdmin(profile.uid);
          expect(userIsAdmin).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test: Valid sessions grant access
  test('Valid non-expired sessions grant access to admin features', async () => {
    await fc.assert(
      fc.asyncProperty(
        adminProfileArb,
        fc.integer({ min: 1, max: 60 }),
        async (profile, durationMinutes) => {
          __test__.addUser(profile.email, 'password123', profile);
          
          // Create session with valid duration
          const sessionId = await createSession(profile.uid, durationMinutes);
          
          // Verify admin access
          const accessResult = await verifyAdminAccess(sessionId);
          
          // Should be authorized
          expect(accessResult.authorized).toBe(true);
          expect(accessResult.userId).toBe(profile.uid);
          expect(accessResult.reason).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test: Role checking works correctly
  test('Role checking correctly identifies user roles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(adminProfileArb, regularUserProfileArb),
        async (profile) => {
          __test__.addUser(profile.email, 'password123', profile);
          
          // Check role
          const hasAdminRole = await hasRole(profile.uid, 'admin');
          const hasUserRole = await hasRole(profile.uid, 'user');
          
          if (profile.role === 'admin') {
            expect(hasAdminRole).toBe(true);
            expect(hasUserRole).toBe(false);
          } else {
            expect(hasAdminRole).toBe(false);
            expect(hasUserRole).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test: Empty credentials are rejected
  test('Empty or missing credentials are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(fc.constant(''), fc.constant('valid@email.com')),
        fc.oneof(fc.constant(''), fc.constant('validpassword')),
        async (email, password) => {
          // At least one should be empty
          fc.pre(email === '' || password === '');
          
          const result = await authenticateUser(email, password);
          
          // Should fail
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test: Non-existent users are rejected
  test('Authentication fails for non-existent users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        passwordArb,
        async (email, password) => {
          // Don't add any users
          
          const result = await authenticateUser(email, password);
          
          // Should fail
          expect(result.success).toBe(false);
          expect(result.error).toBe('Invalid credentials');
        }
      ),
      { numRuns: 100 }
    );
  });
});
