import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess, getUserProfile } from '@/lib/auth-utils';
import { addResponse } from '@/services/feedback';

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
    const { ticketId, message } = body;
    
    if (!ticketId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: ticketId, message' },
        { status: 400 }
      );
    }
    
    // Get admin profile for author name
    const adminProfile = await getUserProfile(accessResult.userId!);
    const authorName = adminProfile?.displayName || adminProfile?.email || 'Admin';
    
    await addResponse(ticketId, accessResult.userId!, authorName, message);
    
    return NextResponse.json({
      success: true,
      message: 'Response added successfully',
    });
  } catch (error) {
    console.error('Error adding response:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
