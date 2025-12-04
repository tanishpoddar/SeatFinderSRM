import { ref, get, set, update, push } from 'firebase/database';
import { db } from '@/lib/firebase';
import type { FeedbackTicket, FeedbackFilters, FeedbackResponse } from '@/types';

/**
 * Feedback Service
 * Provides functions for managing feedback tickets and responses
 */

/**
 * Submit new feedback ticket
 */
export async function submitFeedback(
  ticket: Omit<
    FeedbackTicket,
    'id' | 'status' | 'responses' | 'createdAt' | 'updatedAt'
  >
): Promise<string> {
  try {
    const feedbackRef = ref(db, 'feedback');
    const newTicketRef = push(feedbackRef);
    const ticketId = newTicketRef.key!;

    const newTicket: FeedbackTicket = {
      ...ticket,
      id: ticketId,
      status: 'pending',
      responses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await set(newTicketRef, newTicket);

    // Notify admins of new feedback
    // TODO: Send notification to admins about new feedback

    return ticketId;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
}

/**
 * Get user's feedback history
 */
export async function getUserFeedback(userId: string): Promise<FeedbackTicket[]> {
  try {
    const feedbackRef = ref(db, 'feedback');
    const snapshot = await get(feedbackRef);

    if (!snapshot.exists()) {
      return [];
    }

    const tickets: FeedbackTicket[] = [];
    snapshot.forEach((child) => {
      const ticket = child.val() as FeedbackTicket;
      if (ticket.userId === userId) {
        tickets.push(ticket);
      }
    });

    // Sort by creation date (most recent first)
    tickets.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return tickets;
  } catch (error) {
    console.error('Error fetching user feedback:', error);
    return [];
  }
}

/**
 * Get all feedback (admin)
 */
export async function getAllFeedback(
  filters?: FeedbackFilters
): Promise<FeedbackTicket[]> {
  try {
    const feedbackRef = ref(db, 'feedback');
    const snapshot = await get(feedbackRef);

    if (!snapshot.exists()) {
      return [];
    }

    let tickets: FeedbackTicket[] = [];
    snapshot.forEach((child) => {
      tickets.push(child.val() as FeedbackTicket);
    });

    // Apply filters
    if (filters) {
      if (filters.status) {
        tickets = tickets.filter((t) => t.status === filters.status);
      }
      if (filters.category) {
        tickets = tickets.filter((t) => t.category === filters.category);
      }
    }

    // Sort by creation date (most recent first)
    tickets.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return tickets;
  } catch (error) {
    console.error('Error fetching all feedback:', error);
    return [];
  }
}

/**
 * Add response to ticket
 */
export async function addResponse(
  ticketId: string,
  authorId: string,
  authorName: string,
  message: string
): Promise<void> {
  try {
    const ticketRef = ref(db, `feedback/${ticketId}`);
    const snapshot = await get(ticketRef);

    if (!snapshot.exists()) {
      throw new Error('Ticket not found');
    }

    const ticket = snapshot.val() as FeedbackTicket;

    const newResponse: FeedbackResponse = {
      id: `response-${Date.now()}`,
      authorId,
      authorName,
      message,
      timestamp: new Date().toISOString(),
    };

    const updatedResponses = [...ticket.responses, newResponse];

    await update(ticketRef, {
      responses: updatedResponses,
      status: ticket.status === 'pending' ? 'in-progress' : ticket.status,
      updatedAt: new Date().toISOString(),
    });

    // Notify user of response
    // TODO: Send notification to user about response
  } catch (error) {
    console.error('Error adding response:', error);
    throw error;
  }
}

/**
 * Update ticket status
 */
export async function updateTicketStatus(
  ticketId: string,
  status: FeedbackTicket['status'],
  adminId: string
): Promise<void> {
  try {
    const ticketRef = ref(db, `feedback/${ticketId}`);
    const snapshot = await get(ticketRef);

    if (!snapshot.exists()) {
      throw new Error('Ticket not found');
    }

    const ticket = snapshot.val() as FeedbackTicket;

    await update(ticketRef, {
      status,
      updatedAt: new Date().toISOString(),
    });

    // Notify user of status change
    // TODO: Send notification to user about status change
  } catch (error) {
    console.error('Error updating ticket status:', error);
    throw error;
  }
}

/**
 * Assign ticket to admin
 */
export async function assignTicket(
  ticketId: string,
  adminId: string
): Promise<void> {
  try {
    const ticketRef = ref(db, `feedback/${ticketId}`);
    const snapshot = await get(ticketRef);

    if (!snapshot.exists()) {
      throw new Error('Ticket not found');
    }

    await update(ticketRef, {
      assignedTo: adminId,
      status: 'in-progress',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error assigning ticket:', error);
    throw error;
  }
}

/**
 * Get ticket by ID
 */
export async function getTicketById(ticketId: string): Promise<FeedbackTicket | null> {
  try {
    const ticketRef = ref(db, `feedback/${ticketId}`);
    const snapshot = await get(ticketRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.val() as FeedbackTicket;
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return null;
  }
}
