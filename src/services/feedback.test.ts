import * as fc from 'fast-check';
import type { FeedbackTicket, FeedbackCategory, FeedbackStatus } from '@/types';

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  db: {},
}));

jest.mock('firebase/database', () => ({
  ref: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  push: jest.fn(() => ({ key: `ticket-${Date.now()}-${Math.random()}` })),
}));

// Import after mocking
import {
  submitFeedback,
  getUserFeedback,
  getAllFeedback,
  addResponse,
  updateTicketStatus,
  assignTicket,
} from './feedback';
import { ref, get, set, update, push } from 'firebase/database';

// Custom Generators
const feedbackCategoryArb = fc.constantFrom<FeedbackCategory>(
  'bug',
  'feature-request',
  'seat-issue',
  'general'
);

const feedbackStatusArb = fc.constantFrom<FeedbackStatus>(
  'pending',
  'in-progress',
  'resolved',
  'closed'
);

const feedbackTicketArb = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  userName: fc.string({ minLength: 1, maxLength: 50 }),
  userEmail: fc.emailAddress(),
  category: feedbackCategoryArb,
  subject: fc.string({ minLength: 5, maxLength: 100 }),
  description: fc.string({ minLength: 10, maxLength: 500 }),
  attachments: fc.option(fc.array(fc.webUrl(), { maxLength: 3 }), {
    nil: undefined,
  }),
  status: feedbackStatusArb,
  priority: fc.option(fc.constantFrom('low', 'medium', 'high'), {
    nil: undefined,
  }),
  assignedTo: fc.option(fc.uuid(), { nil: undefined }),
  responses: fc.array(
    fc.record({
      id: fc.uuid(),
      authorId: fc.uuid(),
      authorName: fc.string({ minLength: 1, maxLength: 50 }),
      message: fc.string({ minLength: 5, maxLength: 200 }),
      timestamp: fc
        .integer({ min: 1704067200000, max: 1735689600000 })
        .map((ts) => new Date(ts).toISOString()),
    }),
    { maxLength: 5 }
  ),
  createdAt: fc
    .integer({ min: 1704067200000, max: 1735689600000 })
    .map((ts) => new Date(ts).toISOString()),
  updatedAt: fc
    .integer({ min: 1704067200000, max: 1735689600000 })
    .map((ts) => new Date(ts).toISOString()),
}) as fc.Arbitrary<FeedbackTicket>;

// Helper to mock Firebase responses
function mockFirebaseGetTickets(tickets: FeedbackTicket[]) {
  const getMock = get as jest.MockedFunction<typeof get>;
  const refMock = ref as jest.MockedFunction<typeof ref>;

  refMock.mockImplementation((db: any, path?: string) => {
    return { _path: path } as any;
  });

  getMock.mockImplementation((reference: any) => {
    const path = reference._path || '';

    if (path === 'feedback') {
      return Promise.resolve({
        exists: () => tickets.length > 0,
        forEach: (callback: (child: any) => void) => {
          tickets.forEach((ticket) => {
            callback({
              key: ticket.id,
              val: () => ticket,
            });
          });
        },
      } as any);
    }

    if (path.startsWith('feedback/')) {
      const ticketId = path.split('/')[1];
      const ticket = tickets.find((t) => t.id === ticketId);
      return Promise.resolve({
        exists: () => ticket !== undefined,
        val: () => ticket,
      } as any);
    }

    return Promise.resolve({ exists: () => false } as any);
  });
}

describe('Feedback Service - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: admin-dashboard-analytics, Property 53: Ticket creation with unique ID
  describe('Property 53: Ticket creation with unique ID', () => {
    test('created tickets should have unique IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              userId: fc.uuid(),
              userName: fc.string({ minLength: 1, maxLength: 50 }),
              userEmail: fc.emailAddress(),
              category: feedbackCategoryArb,
              subject: fc.string({ minLength: 5, maxLength: 100 }),
              description: fc.string({ minLength: 10, maxLength: 500 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (ticketData) => {
            // Clear mocks for each property test run
            jest.clearAllMocks();
            
            const setMock = set as jest.MockedFunction<typeof set>;
            const pushMock = push as jest.MockedFunction<typeof push>;

            const createdIds: string[] = [];

            // Mock push to return unique IDs
            pushMock.mockImplementation(() => {
              const id = `ticket-${Date.now()}-${Math.random()}`;
              createdIds.push(id);
              return { key: id } as any;
            });

            // Create multiple tickets
            for (const data of ticketData) {
              await submitFeedback(data);
            }

            // Property: All ticket IDs should be unique
            const uniqueIds = new Set(createdIds);
            expect(uniqueIds.size).toBe(createdIds.length);

            // Property: Set should be called for each ticket
            expect(setMock).toHaveBeenCalledTimes(ticketData.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('submitted ticket should have pending status', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            userName: fc.string({ minLength: 1, maxLength: 50 }),
            userEmail: fc.emailAddress(),
            category: feedbackCategoryArb,
            subject: fc.string({ minLength: 5, maxLength: 100 }),
            description: fc.string({ minLength: 10, maxLength: 500 }),
          }),
          async (ticketData) => {
            const setMock = set as jest.MockedFunction<typeof set>;

            await submitFeedback(ticketData);

            // Property: Ticket should be created with pending status
            expect(setMock).toHaveBeenCalled();
            const createdTicket = setMock.mock.calls[0][1] as FeedbackTicket;
            expect(createdTicket.status).toBe('pending');
            expect(createdTicket.responses).toEqual([]);
            expect(createdTicket.createdAt).toBeDefined();
            expect(createdTicket.updatedAt).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: admin-dashboard-analytics, Property 57: Response updates status and notifies
  describe('Property 57: Response updates status and notifies', () => {
    test('adding response should update ticket and change status from pending', async () => {
      await fc.assert(
        fc.asyncProperty(
          feedbackTicketArb,
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 5, maxLength: 200 }),
          async (ticket, adminId, adminName, message) => {
            // Start with pending ticket
            const pendingTicket = { ...ticket, status: 'pending' as FeedbackStatus };

            const updateMock = update as jest.MockedFunction<typeof update>;
            const updates: any[] = [];

            updateMock.mockImplementation((ref: any, data: any) => {
              updates.push({ ref, data });
              return Promise.resolve();
            });

            mockFirebaseGetTickets([pendingTicket]);

            await addResponse(ticket.id, adminId, adminName, message);

            // Property: Ticket should be updated
            expect(updateMock).toHaveBeenCalled();
            const ticketUpdate = updates[0];

            // Property: Status should change from pending to in-progress
            expect(ticketUpdate.data.status).toBe('in-progress');

            // Property: Response should be added
            expect(ticketUpdate.data.responses).toBeDefined();
            expect(ticketUpdate.data.responses.length).toBe(
              pendingTicket.responses.length + 1
            );

            // Property: New response should have correct data
            const newResponse = ticketUpdate.data.responses[ticketUpdate.data.responses.length - 1];
            expect(newResponse.authorId).toBe(adminId);
            expect(newResponse.authorName).toBe(adminName);
            expect(newResponse.message).toBe(message);
            expect(newResponse.timestamp).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('adding response to non-pending ticket should not change status', async () => {
      await fc.assert(
        fc.asyncProperty(
          feedbackTicketArb,
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 5, maxLength: 200 }),
          async (ticket, adminId, adminName, message) => {
            // Start with in-progress ticket
            const inProgressTicket = {
              ...ticket,
              status: 'in-progress' as FeedbackStatus,
            };

            const updateMock = update as jest.MockedFunction<typeof update>;
            const updates: any[] = [];

            updateMock.mockImplementation((ref: any, data: any) => {
              updates.push({ ref, data });
              return Promise.resolve();
            });

            mockFirebaseGetTickets([inProgressTicket]);

            await addResponse(ticket.id, adminId, adminName, message);

            // Property: Status should remain in-progress
            const ticketUpdate = updates[0];
            expect(ticketUpdate.data.status).toBe('in-progress');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Additional tests for feedback filtering and retrieval
  describe('Feedback filtering and retrieval', () => {
    test('getUserFeedback should only return tickets for specified user', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(feedbackTicketArb, { minLength: 5, maxLength: 20 }),
          fc.uuid(),
          async (tickets, targetUserId) => {
            // Set some tickets to target user
            const modifiedTickets = tickets.map((t, index) => ({
              ...t,
              userId: index % 3 === 0 ? targetUserId : t.userId,
            }));

            mockFirebaseGetTickets(modifiedTickets);

            const userTickets = await getUserFeedback(targetUserId);

            // Property: All returned tickets should belong to target user
            userTickets.forEach((ticket) => {
              expect(ticket.userId).toBe(targetUserId);
            });

            // Property: Should return all tickets for target user
            const expectedCount = modifiedTickets.filter(
              (t) => t.userId === targetUserId
            ).length;
            expect(userTickets.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('getAllFeedback with status filter should only return matching tickets', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(feedbackTicketArb, { minLength: 10, maxLength: 30 }),
          feedbackStatusArb,
          async (tickets, filterStatus) => {
            mockFirebaseGetTickets(tickets);

            const filtered = await getAllFeedback({ status: filterStatus });

            // Property: All returned tickets should have the filtered status
            filtered.forEach((ticket) => {
              expect(ticket.status).toBe(filterStatus);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('getAllFeedback with category filter should only return matching tickets', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(feedbackTicketArb, { minLength: 10, maxLength: 30 }),
          feedbackCategoryArb,
          async (tickets, filterCategory) => {
            mockFirebaseGetTickets(tickets);

            const filtered = await getAllFeedback({ category: filterCategory });

            // Property: All returned tickets should have the filtered category
            filtered.forEach((ticket) => {
              expect(ticket.category).toBe(filterCategory);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('updateTicketStatus should change ticket status', async () => {
      await fc.assert(
        fc.asyncProperty(
          feedbackTicketArb,
          feedbackStatusArb,
          fc.uuid(),
          async (ticket, newStatus, adminId) => {
            const updateMock = update as jest.MockedFunction<typeof update>;
            const updates: any[] = [];

            updateMock.mockImplementation((ref: any, data: any) => {
              updates.push({ ref, data });
              return Promise.resolve();
            });

            mockFirebaseGetTickets([ticket]);

            await updateTicketStatus(ticket.id, newStatus, adminId);

            // Property: Status should be updated
            expect(updateMock).toHaveBeenCalled();
            const statusUpdate = updates[0];
            expect(statusUpdate.data.status).toBe(newStatus);
            expect(statusUpdate.data.updatedAt).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('assignTicket should set assignedTo and change status to in-progress', async () => {
      await fc.assert(
        fc.asyncProperty(
          feedbackTicketArb,
          fc.uuid(),
          async (ticket, adminId) => {
            const updateMock = update as jest.MockedFunction<typeof update>;
            const updates: any[] = [];

            updateMock.mockImplementation((ref: any, data: any) => {
              updates.push({ ref, data });
              return Promise.resolve();
            });

            mockFirebaseGetTickets([ticket]);

            await assignTicket(ticket.id, adminId);

            // Property: Ticket should be assigned and status updated
            expect(updateMock).toHaveBeenCalled();
            const assignUpdate = updates[0];
            expect(assignUpdate.data.assignedTo).toBe(adminId);
            expect(assignUpdate.data.status).toBe('in-progress');
            expect(assignUpdate.data.updatedAt).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
