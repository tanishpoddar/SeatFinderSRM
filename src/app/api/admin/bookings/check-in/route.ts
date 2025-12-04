import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth-utils';
import { manualCheckIn } from '@/services/booking-management';

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
    const { bookingId, reason } = body;
    
    if (!bookingId || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingId, reason' },
        { status: 400 }
      );
    }
    
    await manualCheckIn(bookingId, accessResult.userId!, reason);
    
    return NextResponse.json({
      success: true,
      message: 'Manual check-in completed successfully',
    });
  } catch (error) {
    console.error('Error during manual check-in:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
