import { NextRequest, NextResponse } from 'next/server';
import { submitFeedback } from '@/services/feedback';
import { FeedbackCategory } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Auth is handled client-side with Firebase Auth
    const body = await request.json();
    const { userId, userName, userEmail, category, subject, description, attachments } = body;
    
    if (!userId || !userName || !userEmail || !category || !subject || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const ticketId = await submitFeedback({
      userId,
      userName,
      userEmail,
      category: category as FeedbackCategory,
      subject,
      description,
      attachments: attachments || [],
    });
    
    return NextResponse.json({
      success: true,
      ticketId,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
