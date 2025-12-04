import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth-utils';
import { extendBookingWithPolicy } from '@/services/booking-extension';

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
    
    const sessionValidation = await validateSession(sessionId);
    
    if (!sessionValidation.valid) {
      return NextResponse.json(
        { error: sessionValidation.expired ? 'Session expired' : 'Invalid session' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { bookingId, additionalMinutes } = body;
    
    if (!bookingId || !additionalMinutes) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingId, additionalMinutes' },
        { status: 400 }
      );
    }
    
    if (typeof additionalMinutes !== 'number' || additionalMinutes <= 0) {
      return NextResponse.json(
        { error: 'additionalMinutes must be a positive number' },
        { status: 400 }
      );
    }
    
    const result = await extendBookingWithPolicy(bookingId, additionalMinutes);
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.message,
        alternatives: result.alternatives,
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      newEndTime: result.newEndTime,
      message: 'Booking extended successfully',
    });
  } catch (error) {
    console.error('Error extending booking:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
