import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth-utils';
import { unflagUser } from '@/services/user-management';

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
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }
    
    await unflagUser(userId, accessResult.userId!);
    
    return NextResponse.json({
      success: true,
      message: 'User unflagged successfully',
    });
  } catch (error) {
    console.error('Error unflagging user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
