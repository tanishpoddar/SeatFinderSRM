import { NextResponse } from 'next/server';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebase';

/**
 * Initialize feedback bucket in Firebase
 * Visit: http://localhost:3000/api/init/feedback
 */
export async function GET() {
  try {
    const feedbackRef = ref(db, 'feedback');
    
    // Create sample feedback ticket
    const sampleTicket = {
      'sample_ticket_001': {
        id: 'sample_ticket_001',
        userId: 'sample_user',
        userName: 'Sample User',
        userEmail: 'sample@example.com',
        category: 'general',
        subject: 'Welcome to Feedback System',
        description: 'This is a sample feedback ticket. You can now submit your own feedback!',
        status: 'pending',
        priority: 'low',
        responses: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    };

    await set(feedbackRef, sampleTicket);

    return NextResponse.json({
      success: true,
      message: 'Feedback bucket initialized successfully!',
      data: sampleTicket,
    });
  } catch (error: any) {
    console.error('Error initializing feedback:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize feedback bucket',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
