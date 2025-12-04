import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth-utils';
import { manuallyAssignSeat } from '@/services/booking-management';

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('session')?.value || 
                     request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Unauthorized - No session provided' },
        { status: 401 }
      );
    }
    
    const accessResult = await verifyAdminAccess(sessionId);
    
    if (!accessResult.authorized) {
      return NextResponse.json(
        { error: accessResult.reason || 'Unauthorized' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { seatId, userId, userName, userEmail, startTime, endTime } = body;
    
    if (!seatId || !userId || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields: seatId, userId, startTime, endTime' },
        { status: 400 }
      );
    }
    
    const booking = await manuallyAssignSeat(
      seatId,
      userId,
      userName || 'User',
      userEmail || '',
      new Date(startTime),
      new Date(endTime),
      accessResult.userId!
    );
    
    return NextResponse.json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error('Error assigning seat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
