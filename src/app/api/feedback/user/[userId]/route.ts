import { NextRequest, NextResponse } from 'next/server';
import { getUserFeedback } from '@/services/feedback';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    
    // For now, allow direct access since auth is handled client-side
    // In production, you'd want to verify Firebase ID token here
    
    const tickets = await getUserFeedback(userId);
    
    return NextResponse.json({ tickets });
  } catch (error) {
    console.error('Error fetching user feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
