import { NextRequest, NextResponse } from 'next/server';
import { getUserStatistics } from '@/services/user-management';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    
    // For now, allow direct access since auth is handled client-side
    // In production, you'd want to verify Firebase ID token here
    
    const statistics = await getUserStatistics(userId);
    
    return NextResponse.json({ statistics });
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
